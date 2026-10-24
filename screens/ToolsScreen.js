import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, SectionList, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Badge from '../components/Badge';
import StatCard from '../components/StatCard';
import ListControls from '../components/ListControls';
import ToolHistoryModal from '../components/ToolHistoryModal';

const ATTENTION_STATUSES = ['Maintenance', 'Disposal'];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest to oldest' },
  { value: 'oldest', label: 'Oldest to newest' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'status', label: 'Status' },
];

const keyExtractor = (item) => item.asset_id;

// Memoized so typing in search / tapping a filter only re-renders rows whose
// item actually changed, instead of all of them on every state change.
const ToolRow = React.memo(function ToolRow({ item, styles, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(item)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toolName}>{item.tool_name}</Text>
        <Text style={styles.toolMeta}>{item.asset_id} · {item.condition} · Qty {item.qty}</Text>
        {item.stock_tracked && item.borrowed_qty > 0 && (
          <Text style={styles.toolBorrowedHint}>{item.borrowed_qty} currently borrowed</Text>
        )}
      </View>
      <Badge status={item.status} />
    </TouchableOpacity>
  );
});

const isSportsCategory = (cat) => /sport/i.test(cat || '');

// One screen backs both tabs: Tools hides Sports-category items, Sports shows
// only those, so equipment management stays separate from tool management.
export default function ToolsScreen({ sports = false }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null); // 'Available' | 'Borrowed' | 'Attention' | null
  const [sortBy, setSortBy] = useState('name_asc');
  const [search, setSearch] = useState('');
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanMode, setScanMode] = useState(null); // 'borrow' | 'return' | null
  const [scanResult, setScanResult] = useState(null);
  const [pendingScan, setPendingScan] = useState(null); // { mode, code, tool }
  const [borrowQty, setBorrowQty] = useState(1);
  const [returnQty, setReturnQty] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [historyTool, setHistoryTool] = useState(null);
  const [recentIds, setRecentIds] = useState([]); // asset_ids just borrowed/returned, newest first
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const filterOptions = [{ value: null, label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))];

  // Dashboard totals always reflect the full inventory, independent of
  // whatever search/category/status filter is currently narrowing the list
  // below — that's what makes it read as an at-a-glance overview.
  const { totalCount, availableCount, borrowedCount, attentionCount } = useMemo(() => ({
    totalCount: tools.length,
    availableCount: tools.filter((t) => t.status === 'Available').length,
    // A stock-tracked item can have some units out on loan while still reading
    // "Available" overall (stock remains) — count those alongside fully
    // checked-out items so this stat reflects every active borrow, not just
    // ones that flipped the whole item's status.
    borrowedCount: tools.filter((t) => t.status === 'Borrowed' || t.borrowed_qty > 0).length,
    attentionCount: tools.filter((t) => ATTENTION_STATUSES.includes(t.status)).length,
  }), [tools]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    tools.forEach((t) => {
      const cat = t.category || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [tools]);

  // Memoized so `sections` below (and therefore the whole SectionList) only
  // gets a new array when a filter/search/sort/data input actually changes.
  const visibleTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (sortBy === 'oldest' ? [...tools].reverse() : tools)
      .filter((t) => !category || t.category === category)
      .filter((t) => {
        if (!statusFilter) return true;
        if (statusFilter === 'Attention') return ATTENTION_STATUSES.includes(t.status);
        if (statusFilter === 'Borrowed') return t.status === 'Borrowed' || t.borrowed_qty > 0;
        return t.status === statusFilter;
      })
      .filter((t) => !q || t.tool_name.toLowerCase().includes(q) || t.asset_id.toLowerCase().includes(q))
      .sort((a, b) => {
        // API returns newest first (tools.id DESC); sort is stable, so keep that order.
        if (sortBy === 'newest' || sortBy === 'oldest') return 0;
        if (sortBy === 'name_desc') return b.tool_name.localeCompare(a.tool_name);
        if (sortBy === 'status') return a.status.localeCompare(b.status) || a.tool_name.localeCompare(b.tool_name);
        return a.tool_name.localeCompare(b.tool_name);
      });
  }, [tools, category, statusFilter, search, sortBy]);

  // Group into one section per category so the list reads as an organized
  // catalog (Power Tools, Consumable, ...) instead of one long flat list.
  const sections = useMemo(() => {
    const byCategory = {};
    // Items the user just borrowed/returned are pinned in their own section
    // at the top (most recent first) so they can confirm the action landed.
    const recent = recentIds
      .map((id) => visibleTools.find((t) => t.asset_id === id))
      .filter(Boolean);
    const recentSet = new Set(recent.map((t) => t.asset_id));
    visibleTools.filter((t) => !recentSet.has(t.asset_id)).forEach((t) => {
      const cat = t.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t);
    });
    const catSections = Object.keys(byCategory)
      .sort((a, b) => a.localeCompare(b))
      .map((cat) => ({ title: cat, data: byCategory[cat] }));
    return recent.length ? [{ title: 'Recent activity', data: recent }, ...catSections] : catSections;
  }, [visibleTools, recentIds]);

  const renderItem = useCallback(
    ({ item }) => <ToolRow item={item} styles={styles} onPress={setHistoryTool} />,
    [styles],
  );

  const renderSectionHeader = useCallback(({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
      <View style={styles.sectionHeaderCount}>
        <Text style={styles.sectionHeaderCountText}>{section.data.length}</Text>
      </View>
    </View>
  ), [styles]);

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get('/tools/categories');
        setCategories((res.data.categories || []).filter((c) => isSportsCategory(c) === sports));
      } catch (e) {
        // Non-fatal — fall back to showing all tools ungrouped.
      }
    })();
  }, [sports]);

  const loadTools = useCallback(async () => {
    try {
      // Fetch the whole inventory once — category/status filtering happens
      // client-side so the dashboard totals and category chips stay accurate
      // no matter what the list below is currently narrowed to.
      const res = await client.get('/tools');
      setTools((res.data.tools || []).filter((t) => isSportsCategory(t.category) === sports));
    } catch (e) {
      Alert.alert('Error loading tools', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sports]);

  useEffect(() => { setLoading(true); loadTools(); }, [loadTools]);

  async function openScanner(mode) {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission needed', 'Enable camera access to scan tool/ID codes.');
        return;
      }
    }
    scanLockRef.current = false;
    setScanMode(mode);
  }

  async function handleBarcodeScanned({ data }) {
    // The camera keeps emitting detections for the same frame until it
    // actually unmounts — ignore anything after the first hit for this session.
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    const mode = scanMode;
    setScanMode(null);

    try {
      const res = await client.get(`/tools/lookup/${encodeURIComponent(data)}`);
      setPendingScan({ mode, code: data, tool: res.data });
      setBorrowQty(1);
      // Default to returning everything still outstanding on the record a
      // return scan would target — the user can dial it down for a partial return.
      setReturnQty(Math.max(1, res.data?.returnable_qty ?? res.data?.borrowed_qty ?? 1));
    } catch (e) {
      Alert.alert('Scan failed', e.message);
    }
  }

  function adjustBorrowQty(delta) {
    const max = pendingScan?.tool?.qty ?? 1;
    setBorrowQty((q) => Math.min(Math.max(q + delta, 1), max));
  }

  function adjustReturnQty(delta) {
    const max = Math.max(1, pendingScan?.tool?.returnable_qty ?? pendingScan?.tool?.borrowed_qty ?? 1);
    setReturnQty((q) => Math.min(Math.max(q + delta, 1), max));
  }

  // Whether the scanned item is actually eligible for the action being
  // confirmed — a stock-tracked item stays "Available" while some units
  // remain, so eligibility for return hinges on borrowed_qty, not status.
  function isScanEligible(scan) {
    if (!scan?.tool) return false;
    if (scan.mode === 'borrow') return scan.tool.available === true;
    // Consumables are used up when borrowed, not checked out — there's
    // nothing to bring back.
    if (scan.tool.category === 'Consumable') return false;
    return scan.tool.stock_tracked ? scan.tool.returnable_qty > 0 : scan.tool.available === false;
  }

  async function confirmPendingScan() {
    if (!pendingScan) return;
    const { mode, code, tool } = pendingScan;
    setConfirming(true);
    try {
      const endpoint = mode === 'borrow' ? '/tools/scan-borrow' : '/tools/scan-return';
      const payload = mode === 'borrow'
        ? {
          code,
          employee_id: user?.employee_id,
          borrower_name: user?.name,
          department: user?.department,
          quantity: borrowQty,
        }
        : tool?.stock_tracked
          ? { code, quantity: returnQty }
          : { code };
      const res = await client.post(endpoint, payload);
      setScanResult(res.data);
      setPendingScan(null);
      const doneId = tool?.asset_id ?? code;
      setRecentIds((ids) => [doneId, ...ids.filter((id) => id !== doneId)].slice(0, 5));
      loadTools();
    } catch (e) {
      Alert.alert('Scan failed', e.message);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={styles.statRow}>
          <StatCard
            value={totalCount}
            label="Total tools"
            active={!statusFilter}
            onPress={() => setStatusFilter(null)}
          />
          <StatCard
            value={availableCount}
            label="Available"
            color={colors.success}
            active={statusFilter === 'Available'}
            onPress={() => setStatusFilter((f) => (f === 'Available' ? null : 'Available'))}
          />
          <StatCard
            value={borrowedCount}
            label="Borrowed"
            color={colors.warning}
            active={statusFilter === 'Borrowed'}
            onPress={() => setStatusFilter((f) => (f === 'Borrowed' ? null : 'Borrowed'))}
          />
          <StatCard
            value={attentionCount}
            label="Needs attention"
            color={colors.danger}
            active={statusFilter === 'Attention'}
            onPress={() => setStatusFilter((f) => (f === 'Attention' ? null : 'Attention'))}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {categories.map((c) => {
            const active = category === c;
            return (
              <TouchableOpacity
                key={c}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setCategory((prev) => (prev === c ? null : c))}
              >
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                  {c}
                </Text>
                <View style={[styles.categoryChipCount, active && styles.categoryChipCountActive]}>
                  <Text style={[styles.categoryChipCountText, active && styles.categoryChipCountTextActive]}>
                    {categoryCounts[c] || 0}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ListControls
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search tools..."
          filter={{
            value: category,
            options: filterOptions,
            onChange: setCategory,
            title: 'Filter by category',
            label: 'All categories',
          }}
          sort={{
            value: sortBy,
            options: SORT_OPTIONS,
            onChange: setSortBy,
            title: 'Sort by',
          }}
        />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.scanBtn} onPress={() => openScanner('borrow')}>
          <Text style={styles.scanBtnText}>⧉ Scan borrow</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.scanBtn, styles.scanBtnOutline]} onPress={() => openScanner('return')}>
          <Text style={[styles.scanBtnText, styles.scanBtnOutlineText]}>⧉ Scan return</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTools(); }} />}
          contentContainerStyle={{ padding: 16 }}
          stickySectionHeadersEnabled
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          ListEmptyComponent={(
            <Text style={styles.empty}>
              {search.trim() || category || statusFilter
                ? 'No tools match your current search/filters.'
                : 'No tools registered yet.'}
            </Text>
          )}
        />
      )}

      {scanResult && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>✅ Scan result — {scanResult.action}</Text>
          <Text style={styles.resultLine}>Borrower: {scanResult.borrower_name}</Text>
          <Text style={styles.resultLine}>Tool: {scanResult.tool_name} ({scanResult.asset_id})</Text>
          {scanResult.quantity > 1 && (
            <Text style={styles.resultLine}>Quantity: {scanResult.quantity}</Text>
          )}
          {scanResult.consumed && (
            <Text style={styles.resultLine}>Status: Consumed — this item is used up and can't be returned.</Text>
          )}
          {scanResult.partial && (
            <Text style={styles.resultLine}>Partial return — some units are still out on this record.</Text>
          )}
          <Text style={styles.resultLine}>Time: {scanResult.timestamp}</Text>
          <TouchableOpacity onPress={() => setScanResult(null)}>
            <Text style={styles.dismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={!!scanMode} animationType="slide">
        {scanMode && (
          <CameraView
            style={{ flex: 1 }}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: [
                'qr', 'aztec', 'ean13', 'ean8', 'pdf417', 'upc_e',
                'datamatrix', 'code39', 'code93', 'itf14', 'codabar', 'code128', 'upc_a',
              ],
            }}
          />
        )}
        <View style={styles.frameOverlay} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.frameCorner, styles.frameCornerTL]} />
            <View style={[styles.frameCorner, styles.frameCornerTR]} />
            <View style={[styles.frameCorner, styles.frameCornerBL]} />
            <View style={[styles.frameCorner, styles.frameCornerBR]} />
          </View>
        </View>
        <View style={styles.scannerHint}>
          <Text style={styles.scannerHintText}>Scan the tool's QR tag</Text>
        </View>
        <TouchableOpacity style={styles.closeScanner} onPress={() => setScanMode(null)}>
          <Text style={{ color: colors.white, fontWeight: '600' }}>Cancel scan</Text>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!pendingScan} animationType="fade" transparent>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.formTitle}>
              Confirm {pendingScan?.mode === 'borrow' ? 'borrow' : 'return'}
            </Text>
            <Text style={styles.confirmLine}>Tool: {pendingScan?.tool?.tool_name}</Text>
            <Text style={styles.confirmLine}>Asset ID: {pendingScan?.tool?.asset_id}</Text>
            {pendingScan?.tool?.condition ? (
              <Text style={styles.confirmLine}>Condition: {pendingScan.tool.condition}</Text>
            ) : null}
            {pendingScan?.tool?.status ? (
              <Text style={styles.confirmLine}>Status: {pendingScan.tool.status}</Text>
            ) : null}
            {pendingScan?.tool && !isScanEligible(pendingScan) ? (
              <Text style={styles.confirmWarning}>
                {pendingScan.mode === 'borrow'
                  ? "This tool isn't marked Available right now."
                  : pendingScan.tool.category === 'Consumable'
                    ? "Consumables are used up when borrowed — they can't be returned."
                    : "This tool isn't currently marked as borrowed."}
              </Text>
            ) : null}

            {pendingScan?.mode === 'return' && pendingScan?.tool?.stock_tracked && pendingScan.tool.returnable_qty > 0 ? (
              <View style={styles.qtyRow}>
                <View>
                  <Text style={styles.confirmLine}>Quantity to return</Text>
                  <Text style={styles.qtyHint}>{pendingScan.tool.returnable_qty} currently borrowed on this record</Text>
                </View>
                <View style={styles.qtyStepper}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, returnQty <= 1 && styles.qtyBtnDisabled]}
                    onPress={() => adjustReturnQty(-1)}
                    disabled={returnQty <= 1}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{returnQty}</Text>
                  <TouchableOpacity
                    style={[styles.qtyBtn, returnQty >= pendingScan.tool.returnable_qty && styles.qtyBtnDisabled]}
                    onPress={() => adjustReturnQty(1)}
                    disabled={returnQty >= pendingScan.tool.returnable_qty}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {pendingScan?.mode === 'borrow' && isScanEligible(pendingScan) && pendingScan.tool.category !== 'Consumable' ? (
              <Text style={styles.qtyHint}>Due back within 3 days — you can extend it from the item's history.</Text>
            ) : null}

            {pendingScan?.mode === 'borrow' && pendingScan?.tool && isScanEligible(pendingScan) ? (
              <View style={styles.qtyRow}>
                <View>
                  <Text style={styles.confirmLine}>Quantity to borrow</Text>
                  <Text style={styles.qtyHint}>
                    {pendingScan.tool.stock_tracked
                      ? `${pendingScan.tool.qty} in stock`
                      : 'Single-unit item'}
                  </Text>
                </View>
                <View style={styles.qtyStepper}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, borrowQty <= 1 && styles.qtyBtnDisabled]}
                    onPress={() => adjustBorrowQty(-1)}
                    disabled={borrowQty <= 1}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{borrowQty}</Text>
                  <TouchableOpacity
                    style={[styles.qtyBtn, borrowQty >= pendingScan.tool.qty && styles.qtyBtnDisabled]}
                    onPress={() => adjustBorrowQty(1)}
                    disabled={borrowQty >= pendingScan.tool.qty}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {pendingScan?.tool && isScanEligible(pendingScan) ? (
              <Text style={styles.confirmPrompt}>Is this the correct item?</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.cancelBtn, !(pendingScan?.tool && isScanEligible(pendingScan)) && { flex: 1 }]}
                onPress={() => setPendingScan(null)}
                disabled={confirming}
              >
                <Text style={styles.cancelBtnText}>
                  {pendingScan?.tool && isScanEligible(pendingScan) ? 'Cancel' : 'Close'}
                </Text>
              </TouchableOpacity>
              {pendingScan?.tool && isScanEligible(pendingScan) ? (
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={confirmPendingScan}
                  disabled={confirming}
                >
                  {confirming ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.confirmBtnText}>
                      Confirm {pendingScan?.mode === 'borrow' ? 'borrow' : 'return'}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <ToolHistoryModal
        visible={!!historyTool}
        tool={historyTool}
        onClose={() => setHistoryTool(null)}
      />
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  statRow: { flexDirection: 'row', marginBottom: 12 },
  categoryScroll: { marginBottom: 12 },
  categoryScrollContent: { gap: 8, paddingRight: 4 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  categoryChipActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  categoryChipTextActive: { color: colors.white },
  categoryChipCount: {
    backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 6, minWidth: 20, alignItems: 'center',
  },
  categoryChipCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  categoryChipCountText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  categoryChipCountTextActive: { color: colors.white },
  actionRow: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: colors.surface },
  scanBtn: { flex: 1, backgroundColor: colors.maroon, borderRadius: 8, padding: 12, alignItems: 'center' },
  scanBtnOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.maroon },
  scanBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  scanBtnOutlineText: { color: colors.maroon },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bg, paddingVertical: 8, marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 12, fontWeight: '700', color: colors.maroon,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  sectionHeaderCount: {
    backgroundColor: colors.maroonLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  sectionHeaderCountText: { fontSize: 11, fontWeight: '700', color: colors.maroon },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  toolName: { fontSize: 14, fontWeight: '600', color: colors.text },
  toolMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  toolBorrowedHint: { fontSize: 11, color: colors.warning, marginTop: 2, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 30 },
  resultBox: {
    margin: 16, padding: 14, borderRadius: 10, borderWidth: 1,
    borderColor: colors.maroon, backgroundColor: colors.maroonLight,
  },
  resultTitle: { fontWeight: '700', color: colors.maroon, marginBottom: 6 },
  resultLine: { fontSize: 13, color: colors.text, marginTop: 2 },
  dismiss: { color: colors.maroon, marginTop: 8, fontWeight: '600' },
  closeScanner: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: colors.maroon, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24,
  },
  scannerHint: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  scannerHintText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  frameOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  frame: { width: 240, height: 240 },
  frameCorner: { position: 'absolute', width: 32, height: 32, borderColor: colors.white },
  frameCornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  frameCornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  frameCornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  frameCornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: 12, padding: 16 },
  formTitle: { fontWeight: '700', color: colors.maroon, marginBottom: 10, fontSize: 14 },
  confirmLine: { fontSize: 13, color: colors.text, marginBottom: 4 },
  confirmPrompt: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 8, marginBottom: 14 },
  confirmWarning: { fontSize: 12, fontWeight: '600', color: colors.danger, marginTop: 6 },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  qtyStepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.maroon,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnDisabled: { backgroundColor: colors.border },
  qtyBtnText: { color: colors.white, fontSize: 16, fontWeight: '700', lineHeight: 18 },
  qtyValue: { fontSize: 15, fontWeight: '700', color: colors.text, minWidth: 24, textAlign: 'center' },
  qtyHint: { fontSize: 11, color: colors.textMuted },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.textMuted, fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, backgroundColor: colors.maroon },
  confirmBtnText: { color: colors.white, fontWeight: '700' },
});

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import PickerModal from '../components/PickerModal';
import colors from '../theme/colors';

export default function ToolsScreen() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanMode, setScanMode] = useState(null); // 'borrow' | 'return' | null
  const [scanResult, setScanResult] = useState(null);
  const [pendingScan, setPendingScan] = useState(null); // { mode, code, tool }
  const [confirming, setConfirming] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const filterOptions = [{ value: null, label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))];
  const visibleTools = tools.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return t.tool_name.toLowerCase().includes(q) || t.asset_id.toLowerCase().includes(q);
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await client.get('/tools/categories');
        setCategories(res.data.categories || []);
      } catch (e) {
        // Non-fatal — fall back to showing all tools ungrouped.
      }
    })();
  }, []);

  const loadTools = useCallback(async () => {
    try {
      const res = await client.get('/tools', { params: category ? { category } : {} });
      setTools(res.data.tools || []);
    } catch (e) {
      Alert.alert('Error loading tools', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

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
      const res = await client.post('/tools/scan-lookup', { code: data, mode });
      setPendingScan({ mode, code: data, tool: res.data });
    } catch (e) {
      Alert.alert('Scan failed', e.message);
    }
  }

  async function confirmPendingScan() {
    if (!pendingScan) return;
    const { mode, code } = pendingScan;
    setConfirming(true);
    try {
      const endpoint = mode === 'borrow' ? '/tools/scan-borrow' : '/tools/scan-return';
      const payload = mode === 'borrow'
        ? { code, employee_id: user?.employee_id, borrower_name: user?.name, department: user?.department }
        : { code };
      const res = await client.post(endpoint, payload);
      setScanResult(res.data);
      setPendingScan(null);
      loadTools();
    } catch (e) {
      Alert.alert('Scan failed', e.message);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TouchableOpacity style={[styles.filterBtn, category && styles.filterBtnActive]} onPress={() => setFilterOpen(true)}>
          <Ionicons name="filter" size={16} color={category ? colors.white : colors.maroon} />
          <Text style={[styles.filterBtnText, category && styles.filterBtnTextActive]} numberOfLines={1}>
            {category || 'Filter'}
          </Text>
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tools..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <PickerModal
        visible={filterOpen}
        title="Filter by category"
        options={filterOptions}
        onClose={() => setFilterOpen(false)}
        onSelect={(item) => { setCategory(item.value); setFilterOpen(false); }}
      />

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
        <FlatList
          data={visibleTools}
          keyExtractor={(item) => item.asset_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTools(); }} />}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toolName}>{item.tool_name}</Text>
                <Text style={styles.toolMeta}>{item.asset_id} · {item.condition} · Qty {item.qty}</Text>
              </View>
              <Badge status={item.status} />
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{search.trim() ? 'No tools match your search.' : 'No tools registered in this category yet.'}</Text>}
        />
      )}

      {scanResult && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTitle}>✅ Scan result — {scanResult.action}</Text>
          <Text style={styles.resultLine}>Borrower: {scanResult.borrower_name}</Text>
          <Text style={styles.resultLine}>Tool: {scanResult.tool_name} ({scanResult.asset_id})</Text>
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
            {pendingScan?.mode === 'return' && pendingScan?.tool?.current_borrower ? (
              <Text style={styles.confirmLine}>Borrowed by: {pendingScan.tool.current_borrower}</Text>
            ) : null}
            <Text style={styles.confirmPrompt}>Is this the correct item?</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setPendingScan(null)}
                disabled={confirming}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
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
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white,
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: 20, backgroundColor: colors.pink, borderWidth: 1, borderColor: colors.maroon,
    maxWidth: 130,
  },
  filterBtnActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  filterBtnText: { color: colors.maroon, fontWeight: '600', fontSize: 12 },
  filterBtnTextActive: { color: colors.white },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.bg, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text, padding: 0 },
  actionRow: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: colors.white },
  scanBtn: { flex: 1, backgroundColor: colors.maroon, borderRadius: 8, padding: 12, alignItems: 'center' },
  scanBtnOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.maroon },
  scanBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  scanBtnOutlineText: { color: colors.maroon },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  toolName: { fontSize: 14, fontWeight: '600', color: colors.text },
  toolMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
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
  sheet: { backgroundColor: colors.white, borderRadius: 12, padding: 16 },
  formTitle: { fontWeight: '700', color: colors.maroon, marginBottom: 10, fontSize: 14 },
  confirmLine: { fontSize: 13, color: colors.text, marginBottom: 4 },
  confirmPrompt: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 8, marginBottom: 14 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.textMuted, fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, backgroundColor: colors.maroon },
  confirmBtnText: { color: colors.white, fontWeight: '700' },
});

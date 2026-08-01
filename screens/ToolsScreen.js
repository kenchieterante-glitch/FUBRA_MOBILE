import React, { useEffect, useState, useCallback } from 'react';
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
  const [permission, requestPermission] = useCameraPermissions();

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
    setScanMode(mode);
  }

  async function handleBarcodeScanned({ data }) {
    const mode = scanMode;
    setScanMode(null);

    try {
      const endpoint = mode === 'borrow' ? '/tools/scan-borrow' : '/tools/scan-return';
      const payload = mode === 'borrow'
        ? { code: data, employee_id: user?.employee_id, borrower_name: user?.name, department: user?.department }
        : { code: data };
      const res = await client.post(endpoint, payload);
      setScanResult(res.data);
      loadTools();
    } catch (e) {
      Alert.alert('Scan failed', e.message);
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
        <CameraView
          style={{ flex: 1 }}
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={styles.scannerHint}>
          <Text style={styles.scannerHintText}>Scan the tool's QR tag</Text>
        </View>
        <TouchableOpacity style={styles.closeScanner} onPress={() => setScanMode(null)}>
          <Text style={{ color: colors.white, fontWeight: '600' }}>Cancel scan</Text>
        </TouchableOpacity>
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
});

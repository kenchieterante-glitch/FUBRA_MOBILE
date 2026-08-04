import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import colors from '../theme/colors';

export default function GuardScreen() {
  const { user } = useAuth();
  const [keylog, setKeylog] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanMode, setScanMode] = useState(null); // 'borrow' | 'return'
  const [scannedId, setScannedId] = useState(null);
  const [keyItem, setKeyItem] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [k, t] = await Promise.all([
        client.get('/guard/keylog'),
        client.get('/guard/trip-tickets/today'),
      ]);
      setKeylog(k.data.logs || []);
      setTickets(t.data.tickets || []);
    } catch (e) {
      Alert.alert('Error loading guard dashboard', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openScanner(mode) {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission needed', 'Enable camera access to scan campus IDs.');
        return;
      }
    }
    scanLockRef.current = false;
    setScanMode(mode);
  }

  async function handleScanned({ data }) {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    setScanMode(null);
    if (scanMode === 'borrow') {
      setScannedId(data);
      return; // wait for key item name before submitting
    }
    try {
      await client.post('/guard/keylog/scan-return', { code: data });
      load();
    } catch (e) {
      Alert.alert('Scan failed', e.message);
    }
  }

  async function confirmBorrow() {
    if (!keyItem.trim()) {
      Alert.alert('Missing info', 'Enter which key/item is being borrowed.');
      return;
    }
    try {
      await client.post('/guard/keylog/scan-borrow', {
        code: scannedId,
        key_item: keyItem.trim(),
        guard_name: user?.name,
      });
      setScannedId(null);
      setKeyItem('');
      load();
    } catch (e) {
      Alert.alert('Scan failed', e.message);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>⚠ Students are NOT allowed to borrow keys — faculty and staff only</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.scanBtn} onPress={() => openScanner('borrow')}>
          <Text style={styles.scanBtnText}>⧉ Scan borrow</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.scanBtn, styles.scanBtnOutline]} onPress={() => openScanner('return')}>
          <Text style={[styles.scanBtnText, styles.scanBtnOutlineText]}>⧉ Scan return</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Key borrowing log</Text>
      {keylog.map((log) => (
        <View key={log.log_no} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{log.name} · {log.department}</Text>
            <Text style={styles.cardMeta}>{log.key_borrowed}</Text>
            <Text style={styles.cardMeta}>In: {log.scan_in || '—'}  Out: {log.scan_out || '—'}</Text>
          </View>
          <Badge status={log.status} />
        </View>
      ))}

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Today's travel trip tickets</Text>
      {tickets.map((t) => (
        <View key={t.trip_id} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t.driver} · {t.vehicle} ({t.plate})</Text>
            <Text style={styles.cardMeta}>{t.destination}</Text>
            <Text style={styles.cardMeta}>Departure {t.departure} · Return {t.return_time || '—'}</Text>
          </View>
          <Badge status={t.status} />
        </View>
      ))}

      <Modal visible={!!scanMode} animationType="slide">
        {scanMode && (
          <CameraView
            style={{ flex: 1 }}
            onBarcodeScanned={handleScanned}
            barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'upc_a'] }}
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
          <Text style={styles.scannerHintText}>Scan the campus ID barcode</Text>
        </View>
        <TouchableOpacity style={styles.closeScanner} onPress={() => setScanMode(null)}>
          <Text style={{ color: colors.white, fontWeight: '600' }}>Cancel scan</Text>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!scannedId} animationType="fade" transparent>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.formTitle}>Which key/item is being borrowed?</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Library storeroom key"
              value={keyItem}
              onChangeText={setKeyItem}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setScannedId(null); setKeyItem(''); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmBorrow}>
                <Text style={styles.confirmBtnText}>Confirm borrow</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  warningBox: { backgroundColor: colors.dangerBg, borderRadius: 8, padding: 12, marginBottom: 14 },
  warningText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  scanBtn: { flex: 1, backgroundColor: colors.maroon, borderRadius: 8, padding: 12, alignItems: 'center' },
  scanBtnOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.maroon },
  scanBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  scanBtnOutlineText: { color: colors.maroon },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
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
  frame: { width: 280, height: 140 },
  frameCorner: { position: 'absolute', width: 32, height: 32, borderColor: colors.white },
  frameCornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  frameCornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  frameCornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  frameCornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.white, borderRadius: 12, padding: 16 },
  formTitle: { fontWeight: '700', color: colors.maroon, marginBottom: 10, fontSize: 14 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.textMuted, fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, backgroundColor: colors.maroon },
  confirmBtnText: { color: colors.white, fontWeight: '700' },
});

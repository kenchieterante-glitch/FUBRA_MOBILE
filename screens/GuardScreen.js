import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Badge from '../components/Badge';
import ListControls from '../components/ListControls';
import DriverProfileModal from '../components/DriverProfileModal';

// Same ID formats the Login scanner reads - campus IDs print numeric codes in
// all sorts of symbologies, so don't guess which one. Anything that isn't a
// plausible numeric ID (e.g. the card's QR code) is ignored and scanning continues.
const ID_BARCODE_TYPES = ['qr', 'pdf417', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'codabar'];

function isPlausibleId(code) {
  const trimmed = (code || '').trim();
  if (!/^\d{6,10}$/.test(trimmed)) return false;
  if (/^(\d)\1*$/.test(trimmed)) return false;
  return true;
}

const STATUS_OPTIONS = [
  { value: null, label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Newest to oldest' },
  { value: 'oldest', label: 'Oldest to newest' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'status', label: 'Status' },
];

export default function GuardScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [keylog, setKeylog] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanMode, setScanMode] = useState(null); // 'borrow-id' | 'borrow-key' | 'return'
  const [scannedId, setScannedId] = useState(null);
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(0.2);
  const [manualCode, setManualCode] = useState('');
  const [knownTags, setKnownTags] = useState(null); // Set of registered key tag IDs (upper-case)
  const [scanNote, setScanNote] = useState('');
  const [driverId, setDriverId] = useState(null);
  const [detail, setDetail] = useState(null); // { type: 'trip' | 'key', item }
  const [actingTripId, setActingTripId] = useState(null);
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

  // Gate check-in / check-out for a trip ticket - same flow as the web Guard
  // page (Approved -> In Transit -> Completed); the server enforces who may.
  function confirmTripAction(t, action) {
    const label = action === 'in' ? 'Check in' : 'Check out';
    Alert.alert(
      `${label} ${t.trip_id}?`,
      `${t.driver} · ${t.vehicle} (${t.plate})
${t.destination}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          onPress: async () => {
            setActingTripId(t.id);
            try {
              const res = await client.post(`/guard/trip-tickets/${t.id}/check-${action}`);
              Alert.alert(label, res.data?.message || 'Done.');
              await load();
            } catch (e) {
              Alert.alert(`${label} failed`, e.response?.data?.message || e.message);
            } finally {
              setActingTripId(null);
            }
          },
        },
      ],
    );
  }

  // Registered key tags, so step 2 can ignore codes that are not keys (e.g. the
  // QR on the ID card still in view). If the list can't load, fall back to
  // letting the server decide.
  async function loadKnownTags() {
    try {
      const res = await client.get('/guard/keys');
      setKnownTags(new Set((res.data?.keys || []).map((k) => String(k.nfc_uid || '').trim().toUpperCase())));
    } catch (e) {
      setKnownTags(null);
    }
  }

  function isKnownTag(code) {
    return !knownTags || knownTags.has(String(code || '').trim().toUpperCase());
  }

  async function openScanner(mode) {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission needed', 'Enable camera access to scan campus IDs.');
        return;
      }
    }
    scanLockRef.current = false;
    setTorch(false);
    setZoom(0.2);
    setManualCode('');
    setScanNote('');
    setScanMode(mode);
    loadKnownTags();
  }

  // Keys are identified by their QR label (the tag ID printed from the web
  // system's Keys page). Borrow = scan the staff ID, then the key's QR;
  // return = just scan the key's QR.
  async function handleScanned({ data }) {
    if (scanLockRef.current) return;
    // Step 1 only accepts a plausible numeric ID; glare/QR noise is ignored.
    if (scanMode === 'borrow-id' && !isPlausibleId(data) && !/^KEY-/i.test(data)) return;
    // Key steps: skip anything that is not a registered key and keep scanning.
    if (scanMode !== 'borrow-id' && !isKnownTag(data)) {
      scanLockRef.current = true;
      setScanNote('Not a registered key: "' + String(data).slice(0, 28) + '" - keep scanning the key label');
      setTimeout(() => { scanLockRef.current = false; }, 1200);
      return;
    }
    scanLockRef.current = true;
    await processCode(data);
  }

  function submitManualCode() {
    const code = manualCode.trim();
    if (!code) {
      Alert.alert('Missing info', scanMode === 'borrow-id' ? 'Type the number printed on the ID.' : "Type the key's tag ID (e.g. KEY-1A2B3C4D).");
      return;
    }
    if (scanMode !== 'borrow-id' && !isKnownTag(code)) {
      Alert.alert('Not a registered key', '"' + code + '" is not a registered key tag. Check the label and try again.');
      return;
    }
    scanLockRef.current = true;
    setManualCode('');
    processCode(code);
  }

  async function processCode(data) {
    if (scanMode === 'borrow-id') {
      // A key label at step 1 means the codes were scanned in the wrong order.
      if (/^KEY-/i.test(data)) {
        Alert.alert('That is a key label', "Scan the staff member's campus ID first, then the key's QR label.");
        setTimeout(() => { scanLockRef.current = false; }, 1500);
        return;
      }
      setScannedId(data);
      setScanNote('');
      setScanMode('borrow-key');
      setTimeout(() => { scanLockRef.current = false; }, 800); // let the next code come into frame
      return;
    }

    const mode = scanMode;
    const staffId = scannedId;
    setScanMode(null);
    setScannedId(null);
    try {
      const res = mode === 'borrow-key'
        ? await client.post('/guard/keylog/scan-borrow', { code: staffId, nfc_uid: data, guard_name: user?.name })
        : await client.post('/guard/keylog/scan-return', { nfc_uid: data });
      Alert.alert(mode === 'borrow-key' ? 'Key borrowed' : 'Key returned', res.data?.message || 'Done.');
      load();
    } catch (e) {
      Alert.alert('Scan failed', e.response?.data?.message || e.message);
    }
  }

  function cancelScan() {
    setScanMode(null);
    setScannedId(null);
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />;

  const visibleKeylog = (sortBy === 'oldest' ? [...keylog].reverse() : keylog)
    .filter((log) => !statusFilter || (log.status || '').toLowerCase() === statusFilter)
    .filter((log) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (log.name || '').toLowerCase().includes(q) ||
        (log.department || '').toLowerCase().includes(q) ||
        (log.key_borrowed || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      // 'recent' keeps the order the API already returns them in — newest
      // scan-borrow/scan-return first (backend orders by log id DESC) — so
      // the latest activity always surfaces at the top of the list.
      if (sortBy === 'recent' || sortBy === 'oldest') return 0;
      if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '') || (a.name || '').localeCompare(b.name || '');
      return (a.name || '').localeCompare(b.name || '');
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>⚠ Students are NOT allowed to borrow keys — faculty and staff only</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.scanBtn} onPress={() => openScanner('borrow-id')}>
          <Text style={styles.scanBtnText}>⧉ Scan borrow</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.scanBtn, styles.scanBtnOutline]} onPress={() => openScanner('return')}>
          <Text style={[styles.scanBtnText, styles.scanBtnOutlineText]}>⧉ Scan return</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Key borrowing log</Text>
      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, department, key..."
        filter={{
          value: statusFilter,
          options: STATUS_OPTIONS,
          onChange: setStatusFilter,
          title: 'Filter by status',
          label: 'All statuses',
        }}
        sort={{
          value: sortBy,
          options: SORT_OPTIONS,
          onChange: setSortBy,
          title: 'Sort by',
        }}
      />
      {visibleKeylog.length === 0 ? (
        <Text style={styles.empty}>No entries match your search.</Text>
      ) : visibleKeylog.map((log) => (
        <TouchableOpacity key={log.log_no} activeOpacity={0.7} onPress={() => setDetail({ type: 'key', item: log })}>
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{log.name} · {log.department}</Text>
              <Text style={styles.cardMeta}>{log.key_borrowed}</Text>
              <Text style={styles.cardMeta}>In: {log.scan_in || '—'}  Out: {log.scan_out || '—'}</Text>
            </View>
            <Badge status={log.status} />
          </View>
        </TouchableOpacity>
      ))}

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Today's travel trip tickets</Text>
      {tickets.length === 0 ? (
        <Text style={styles.empty}>No trip tickets today or awaiting gate action.</Text>
      ) : tickets.map((t) => (
        <TouchableOpacity key={t.trip_id} activeOpacity={0.7} onPress={() => setDetail({ type: 'trip', item: t })}>
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <View style={styles.driverLine}>
              <TouchableOpacity disabled={!t.driver_id} onPress={() => setDriverId(t.driver_id)}>
                <Text style={[styles.cardTitle, t.driver_id && styles.driverLink]}>{t.driver}</Text>
              </TouchableOpacity>
              <Text style={styles.cardTitle}> · {t.vehicle} ({t.plate})</Text>
            </View>
            <Text style={styles.cardMeta}>{t.trip_id}{t.requester ? ` · Requested by ${t.requester}` : ''}</Text>
            <Text style={styles.cardMeta}>{t.destination}</Text>
            <Text style={styles.cardMeta}>
              {t.date} · Departure {t.departure}{t.check_in ? ` · Out since ${t.check_in}` : ''} · Return {t.return_time || '—'}
            </Text>
            {t.can_check_in || t.can_check_out ? (
              <TouchableOpacity
                style={[styles.tripBtn, t.can_check_out && styles.tripBtnOut, actingTripId === t.id && styles.tripBtnDisabled]}
                disabled={actingTripId === t.id}
                onPress={() => confirmTripAction(t, t.can_check_in ? 'in' : 'out')}
              >
                <Text style={styles.tripBtnText}>{t.can_check_in ? 'Check In' : 'Check Out'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Badge status={t.status} />
        </View>
        </TouchableOpacity>
      ))}

      <Modal visible={!!detail} animationType="fade" transparent onRequestClose={() => setDetail(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            {detail?.type === 'trip' ? (() => {
              const t = tickets.find((x) => x.id === detail.item.id) || detail.item;
              return (
                <>
                  <Text style={styles.formTitle}>Trip ticket {t.trip_id}</Text>
                  {[
                    ['Status', t.status], ['Date', t.date], ['Requested by', t.requester], ['Destination', t.destination],
                    ['Purpose', t.purpose], ['Vehicle', `${t.vehicle} (${t.plate})`], ['Departure', t.departure],
                    ['Checked in', t.check_in], ['Returned', t.return_time],
                  ].map(([k, v]) => (
                    <View key={k} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{k}</Text>
                      <Text style={styles.detailValue}>{v || '—'}</Text>
                    </View>
                  ))}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Driver</Text>
                    {t.driver_id ? (
                      <TouchableOpacity onPress={() => { setDetail(null); setDriverId(t.driver_id); }}>
                        <Text style={[styles.detailValue, styles.driverLink]}>{t.driver} ›</Text>
                      </TouchableOpacity>
                    ) : <Text style={styles.detailValue}>{t.driver}</Text>}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setDetail(null)}>
                      <Text style={styles.cancelBtnText}>Close</Text>
                    </TouchableOpacity>
                    {t.can_check_in || t.can_check_out ? (
                      <TouchableOpacity
                        style={styles.confirmBtn}
                        onPress={() => { setDetail(null); confirmTripAction(t, t.can_check_in ? 'in' : 'out'); }}
                      >
                        <Text style={styles.confirmBtnText}>{t.can_check_in ? 'Check In' : 'Check Out'}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </>
              );
            })() : detail?.type === 'key' ? (
              <>
                <Text style={styles.formTitle}>Key log {detail.item.log_no}</Text>
                {[
                  ['Name', detail.item.name], ['Department', detail.item.department], ['Key', detail.item.key_borrowed],
                  ['Scanned in', detail.item.scan_in], ['Scanned out', detail.item.scan_out], ['Status', detail.item.status],
                ].map(([k, v]) => (
                  <View key={k} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{k}</Text>
                    <Text style={styles.detailValue}>{v || '—'}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity style={styles.confirmBtn} onPress={() => setDetail(null)}>
                    <Text style={styles.confirmBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <DriverProfileModal visible={!!driverId} driverId={driverId} onClose={() => setDriverId(null)} />

      <Modal visible={!!scanMode} animationType="slide">
        {scanMode && (
          <CameraView
            style={{ flex: 1 }}
            enableTorch={torch}
            zoom={zoom}
            onBarcodeScanned={handleScanned}
            barcodeScannerSettings={{ barcodeTypes: scanMode === 'borrow-id' ? ID_BARCODE_TYPES : ['qr'] }}
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
          <Text style={styles.scannerHintText}>
            {scanMode === 'borrow-id'
              ? 'Step 1: scan the staff campus ID'
              : scanMode === 'borrow-key'
                ? "Step 2: scan the key's QR label"
                : "Scan the key's QR label"}
          </Text>
        </View>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={() => setZoom((z) => Math.max(0, +(z - 0.1).toFixed(2)))}>
            <Text style={styles.controlBtnText}>－ zoom</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={() => setTorch((t) => !t)}>
            <Text style={styles.controlBtnText}>{torch ? 'flash on' : 'flash off'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={() => setZoom((z) => Math.min(1, +(z + 0.1).toFixed(2)))}>
            <Text style={styles.controlBtnText}>＋ zoom</Text>
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={styles.manualFallback} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Text style={styles.manualFallbackLabel}>
            {scanMode === 'borrow-id' ? 'Camera not reading it? Type the ID number instead:' : "Camera not reading it? Type the key's tag ID instead:"}
          </Text>
          <View style={styles.manualFallbackRow}>
            <TextInput
              style={styles.manualFallbackInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder={scanMode === 'borrow-id' ? 'e.g. 20241690' : 'e.g. KEY-5F7E4FDF'}
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoCapitalize="characters"
              keyboardType={scanMode === 'borrow-id' ? 'number-pad' : 'default'}
              onSubmitEditing={submitManualCode}
            />
            <TouchableOpacity style={styles.manualFallbackBtn} onPress={submitManualCode}>
              <Text style={styles.manualFallbackBtnText}>Use</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        {scanNote ? (
          <View style={styles.scanNote}>
            <Text style={styles.scannerHintText}>{scanNote}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.closeScanner} onPress={cancelScan}>
          <Text style={{ color: colors.white, fontWeight: '600' }}>Cancel scan</Text>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  warningBox: { backgroundColor: colors.dangerBg, borderRadius: 8, padding: 12, marginBottom: 14 },
  warningText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  scanBtn: { flex: 1, backgroundColor: colors.maroon, borderRadius: 8, padding: 12, alignItems: 'center' },
  scanBtnOutline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.maroon },
  scanBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  scanBtnOutlineText: { color: colors.maroon },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  driverLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  driverLink: { color: colors.maroon, textDecorationLine: 'underline' },
  tripBtn: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: colors.maroon, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  tripBtnOut: { backgroundColor: colors.success },
  tripBtnDisabled: { opacity: 0.5 },
  tripBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 12, color: colors.textMuted, flex: 1 },
  detailValue: { fontSize: 12, color: colors.text, fontWeight: '600', flex: 1.6, textAlign: 'right' },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: 10 },
  closeScanner: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: colors.maroon, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24,
  },
  scannerHint: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  scanNote: { position: 'absolute', top: 110, left: 20, right: 20, backgroundColor: 'rgba(160,0,0,0.85)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  controlsRow: { position: 'absolute', bottom: 230, alignSelf: 'center', flexDirection: 'row', gap: 10 },
  controlBtn: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  controlBtnText: { color: colors.white, fontWeight: '600', fontSize: 12 },
  manualFallback: { position: 'absolute', bottom: 100, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 14, padding: 14 },
  manualFallbackLabel: { color: colors.white, fontSize: 12, marginBottom: 8, textAlign: 'center' },
  manualFallbackRow: { flexDirection: 'row', gap: 8 },
  manualFallbackInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.white, fontSize: 14 },
  manualFallbackBtn: { backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  manualFallbackBtnText: { color: colors.maroon, fontWeight: '700', fontSize: 13 },
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
  sheet: { backgroundColor: colors.surface, borderRadius: 12, padding: 16 },
  formTitle: { fontWeight: '700', color: colors.maroon, marginBottom: 10, fontSize: 14 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13 },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { color: colors.text, fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8, backgroundColor: colors.maroon },
  confirmBtnText: { color: colors.white, fontWeight: '700' },
});

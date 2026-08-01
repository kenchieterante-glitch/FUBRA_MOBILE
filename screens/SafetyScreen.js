import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import client from '../api/client';
import PickerModal from '../components/PickerModal';
import colors from '../theme/colors';

const EXTINGUISHER_TYPES = ['CO2', 'Dry Chemical', 'Wet Chemical', 'Foam'].map((t) => ({ value: t, label: t }));

export default function SafetyScreen() {
  const [buildings, setBuildings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [extinguisher, setExtinguisher] = useState({ type: 'Dry Chemical', kg: '', installed: '', inspected: '', expiry: '' });
  const [unitCode, setUnitCode] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [aircon, setAircon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const load = useCallback(async () => {
    try {
      const res = await client.get('/safety/buildings');
      setBuildings(res.data.buildings || []);
    } catch (e) {
      Alert.alert('Error loading buildings', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function selectBuilding(b) {
    setSelected(b);
    try {
      const res = await client.get('/safety/aircon', { params: { building: b.key } });
      setAircon(res.data.unit || null);
    } catch (e) {
      setAircon(null);
    }
  }

  async function openScanner() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission needed', 'Enable camera access to scan the extinguisher tag.');
        return;
      }
    }
    setScanning(true);
  }

  function handleTagScanned({ data }) {
    setScanning(false);
    setUnitCode(data);
  }

  async function saveExtinguisher() {
    if (!selected) return;
    setSaving(true);
    try {
      await client.post('/safety/fire-extinguishers', {
        building: selected.key,
        ...extinguisher,
        unit_code: unitCode,
      });
      Alert.alert('Saved', 'Fire extinguisher record added.');
      setExtinguisher({ type: 'Dry Chemical', kg: '', installed: '', inspected: '', expiry: '' });
      setUnitCode(null);
      load();
    } catch (e) {
      Alert.alert('Error saving record', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>Fire extinguisher map</Text>
      <View style={styles.grid}>
        {buildings.map((b) => (
          <TouchableOpacity
            key={b.key}
            style={[styles.buildingCard, selected?.key === b.key && styles.buildingCardActive]}
            onPress={() => selectBuilding(b)}
          >
            <Text style={styles.buildingName}>{b.name}</Text>
            <Text style={styles.buildingCount}>🧯 {b.extinguisher_count} units</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selected && (
        <View style={styles.formBox}>
          <Text style={styles.formTitle}>{selected.name} — Fire extinguisher details</Text>

          <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
            <Text style={styles.scanBtnText}>{unitCode ? `⧉ Tag scanned: ${unitCode}` : '⧉ Scan extinguisher QR tag'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.input} onPress={() => setTypePickerOpen(true)}>
            <Text>{extinguisher.type}</Text>
          </TouchableOpacity>
          <TextInput style={styles.input} placeholder="KG capacity" keyboardType="numeric"
            value={extinguisher.kg} onChangeText={(t) => setExtinguisher({ ...extinguisher, kg: t })} />
          <TextInput style={styles.input} placeholder="Date installed (YYYY-MM-DD)"
            value={extinguisher.installed} onChangeText={(t) => setExtinguisher({ ...extinguisher, installed: t })} />
          <TextInput style={styles.input} placeholder="Date inspected (YYYY-MM-DD)"
            value={extinguisher.inspected} onChangeText={(t) => setExtinguisher({ ...extinguisher, inspected: t })} />
          <TextInput style={styles.input} placeholder="Date of expiry (YYYY-MM-DD)"
            value={extinguisher.expiry} onChangeText={(t) => setExtinguisher({ ...extinguisher, expiry: t })} />

          <TouchableOpacity style={styles.saveBtn} onPress={saveExtinguisher} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save to system'}</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Aircon checklist</Text>
          {aircon ? (
            <View style={styles.airconBox}>
              <Text style={styles.vehicleMeta}>Unit: {aircon.unit}</Text>
              <Text style={styles.vehicleMeta}>Location: {aircon.location}</Text>
              <Text style={styles.vehicleMeta}>Last cleaning: {aircon.last_cleaning || '—'}</Text>
              <Text style={styles.vehicleMeta}>Next schedule: {aircon.next_schedule || '—'}</Text>
              <Text style={styles.vehicleMeta}>Condition: {aircon.condition}</Text>
              <Text style={styles.vehicleMeta}>Assigned tech: {aircon.assigned_tech || '—'}</Text>
            </View>
          ) : (
            <Text style={styles.empty}>No aircon unit recorded for this building yet.</Text>
          )}
        </View>
      )}

      <PickerModal
        visible={typePickerOpen}
        title="Extinguisher type"
        options={EXTINGUISHER_TYPES}
        onClose={() => setTypePickerOpen(false)}
        onSelect={(item) => { setExtinguisher({ ...extinguisher, type: item.value }); setTypePickerOpen(false); }}
      />

      <Modal visible={scanning} animationType="slide">
        <CameraView
          style={{ flex: 1 }}
          onBarcodeScanned={handleTagScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={styles.scannerHint}>
          <Text style={styles.scannerHintText}>Scan the extinguisher's QR tag</Text>
        </View>
        <TouchableOpacity style={styles.closeScanner} onPress={() => setScanning(false)}>
          <Text style={{ color: colors.white, fontWeight: '600' }}>Cancel scan</Text>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  buildingCard: {
    width: '31%', backgroundColor: colors.white, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  buildingCardActive: { borderColor: colors.maroon, backgroundColor: colors.maroonLight },
  buildingName: { fontSize: 12, fontWeight: '700', color: colors.text },
  buildingCount: { fontSize: 11, color: colors.danger, marginTop: 4 },
  formBox: {
    backgroundColor: colors.white, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.maroon, marginTop: 8,
  },
  formTitle: { fontWeight: '700', color: colors.maroon, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13, justifyContent: 'center' },
  scanBtn: { borderWidth: 1, borderColor: colors.maroon, borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 8 },
  scanBtnText: { color: colors.maroon, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.maroon, borderRadius: 8, padding: 12, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontWeight: '700' },
  airconBox: { backgroundColor: colors.bg, borderRadius: 8, padding: 12 },
  vehicleMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: 10 },
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

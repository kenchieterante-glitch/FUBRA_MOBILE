import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import client from '../api/client';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import PickerModal from '../components/PickerModal';
import colors from '../theme/colors';

const EXTINGUISHER_TYPES = ['CO2', 'Dry Chemical', 'Wet Chemical', 'Foam'].map((t) => ({ value: t, label: t }));
const CONDITION_OPTIONS = ['Operational', 'Needs Cleaning', 'Needs Repair'].map((t) => ({ value: t, label: t }));

export default function SafetyScreen() {
  const [summary, setSummary] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [extinguisherUnits, setExtinguisherUnits] = useState([]);
  const [loadingBuilding, setLoadingBuilding] = useState(false);

  const [showAddExtinguisher, setShowAddExtinguisher] = useState(false);
  const [extinguisher, setExtinguisher] = useState({ type: 'Dry Chemical', kg: '', installed: '', inspected: '', expiry: '' });
  const [unitCode, setUnitCode] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [aircon, setAircon] = useState(null);
  const [showAddAircon, setShowAddAircon] = useState(false);
  const [newAircon, setNewAircon] = useState({ unit_name: '', condition: 'Operational', assigned_tech: '' });
  const [conditionPickerOpen, setConditionPickerOpen] = useState(false);
  const [savingAircon, setSavingAircon] = useState(false);

  const [loading, setLoading] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([
        client.get('/safety/buildings'),
        client.get('/safety/summary'),
      ]);
      setBuildings(b.data.buildings || []);
      setSummary(s.data);
    } catch (e) {
      Alert.alert('Error loading safety overview', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function selectBuilding(b) {
    setSelected(b);
    setShowAddExtinguisher(false);
    setShowAddAircon(false);
    setLoadingBuilding(true);
    try {
      const [units, unit] = await Promise.all([
        client.get(`/safety/extinguishers/${b.key}`),
        client.get('/safety/aircon', { params: { building: b.key } }),
      ]);
      setExtinguisherUnits(units.data.units || []);
      setAircon(unit.data.unit || null);
    } catch (e) {
      Alert.alert('Error loading building details', e.message);
    } finally {
      setLoadingBuilding(false);
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
      setShowAddExtinguisher(false);
      selectBuilding(selected);
      load();
    } catch (e) {
      Alert.alert('Error saving record', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAirconUnit() {
    if (!selected || !newAircon.unit_name) {
      Alert.alert('Missing info', 'Unit name/model is required.');
      return;
    }
    setSavingAircon(true);
    try {
      await client.post('/safety/aircon', { building: selected.key, ...newAircon });
      setNewAircon({ unit_name: '', condition: 'Operational', assigned_tech: '' });
      setShowAddAircon(false);
      selectBuilding(selected);
    } catch (e) {
      Alert.alert('Error saving aircon unit', e.message);
    } finally {
      setSavingAircon(false);
    }
  }

  async function toggleChecklistTask(task) {
    if (!aircon) return;
    const updatedTasks = aircon.checklist.map((t) =>
      t.id === task.id ? { ...t, done: !t.done } : t
    );
    setAircon({ ...aircon, checklist: updatedTasks });
    try {
      const res = await client.post(`/safety/aircon/checklist/${aircon.id}`, {
        tasks: updatedTasks.map((t) => ({ id: t.id, done: t.done })),
      });
      setAircon({ ...aircon, checklist: res.data.checklist });
    } catch (e) {
      setAircon({ ...aircon, checklist: aircon.checklist });
      Alert.alert('Error updating checklist', e.message);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>Fire safety overview</Text>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <StatCard value={summary?.fire_extinguishers.total ?? 0} label="Extinguishers" />
        <StatCard value={`${summary?.fire_extinguishers.inspection_readiness ?? 0}%`} label="Inspection readiness" />
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <StatCard value={summary?.fire_extinguishers.needs_attention ?? 0} label="Needs attention" color={colors.danger} />
        <StatCard value={summary?.fire_extinguishers.due_for_refill ?? 0} label="Due for refill" color={colors.warning} />
      </View>
      <View style={styles.airconSummary}>
        <Text style={styles.airconSummaryText}>
          🌬️ {summary?.aircon.total ?? 0} aircon units · {summary?.aircon.needs_attention ?? 0} need attention
        </Text>
      </View>

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
        loadingBuilding ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.maroon} />
        ) : (
        <View style={styles.formBox}>
          <Text style={styles.formTitle}>{selected.name}</Text>

          <Text style={styles.subTitle}>Registered fire extinguishers</Text>
          {extinguisherUnits.length === 0 ? (
            <Text style={styles.empty}>No units registered in this building yet.</Text>
          ) : (
            extinguisherUnits.map((u) => (
              <View key={u.id} style={styles.unitRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unitId}>{u.unit_id} · {u.type} ({u.kg}kg)</Text>
                  <Text style={styles.vehicleMeta}>Inspector: {u.inspector || '—'} · Next due: {u.next_due || '—'}</Text>
                </View>
                <Badge status={u.status} />
              </View>
            ))
          )}

          <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowAddExtinguisher((s) => !s)}>
            <Text style={styles.toggleBtnText}>{showAddExtinguisher ? '– Cancel' : '+ Add extinguisher'}</Text>
          </TouchableOpacity>

          {showAddExtinguisher && (
            <View style={styles.addBox}>
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
            </View>
          )}

          <Text style={[styles.subTitle, { marginTop: 20 }]}>Aircon unit & checklist</Text>
          {aircon ? (
            <View style={styles.airconBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={styles.unitId}>{aircon.unit}</Text>
                <Badge status={aircon.condition} />
              </View>
              <Text style={styles.vehicleMeta}>Last cleaning: {aircon.last_cleaning || '—'} · Next schedule: {aircon.next_schedule || '—'}</Text>
              <Text style={styles.vehicleMeta}>Assigned tech: {aircon.assigned_tech || '—'}</Text>

              <View style={{ marginTop: 10 }}>
                {(aircon.checklist || []).map((task) => (
                  <TouchableOpacity key={task.id} style={styles.checklistRow} onPress={() => toggleChecklistTask(task)}>
                    <View style={[styles.checkbox, task.done && styles.checkboxDone]}>
                      {task.done && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <Text style={[styles.checklistText, task.done && styles.checklistTextDone]}>{task.task}</Text>
                    {task.time && <Text style={styles.checklistTime}>{task.time}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.empty}>No aircon unit recorded for this building yet.</Text>
          )}

          <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowAddAircon((s) => !s)}>
            <Text style={styles.toggleBtnText}>{showAddAircon ? '– Cancel' : '+ Register aircon unit'}</Text>
          </TouchableOpacity>

          {showAddAircon && (
            <View style={styles.addBox}>
              <TextInput style={styles.input} placeholder="Unit name / model"
                value={newAircon.unit_name} onChangeText={(t) => setNewAircon({ ...newAircon, unit_name: t })} />
              <TouchableOpacity style={styles.input} onPress={() => setConditionPickerOpen(true)}>
                <Text>{newAircon.condition}</Text>
              </TouchableOpacity>
              <TextInput style={styles.input} placeholder="Assigned technician (optional)"
                value={newAircon.assigned_tech} onChangeText={(t) => setNewAircon({ ...newAircon, assigned_tech: t })} />
              <TouchableOpacity style={styles.saveBtn} onPress={saveAirconUnit} disabled={savingAircon}>
                <Text style={styles.saveBtnText}>{savingAircon ? 'Saving...' : 'Register unit'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        )
      )}

      <PickerModal
        visible={typePickerOpen}
        title="Extinguisher type"
        options={EXTINGUISHER_TYPES}
        onClose={() => setTypePickerOpen(false)}
        onSelect={(item) => { setExtinguisher({ ...extinguisher, type: item.value }); setTypePickerOpen(false); }}
      />
      <PickerModal
        visible={conditionPickerOpen}
        title="Condition"
        options={CONDITION_OPTIONS}
        onClose={() => setConditionPickerOpen(false)}
        onSelect={(item) => { setNewAircon({ ...newAircon, condition: item.value }); setConditionPickerOpen(false); }}
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
  subTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  airconSummary: {
    backgroundColor: colors.infoBg, borderRadius: 8, padding: 10, marginBottom: 20,
  },
  airconSummaryText: { color: colors.info, fontSize: 12, fontWeight: '600' },
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
  formTitle: { fontWeight: '700', color: colors.maroon, marginBottom: 12, fontSize: 15 },
  unitRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  unitId: { fontWeight: '700', color: colors.text, fontSize: 13 },
  toggleBtn: { alignSelf: 'flex-start', marginTop: 10 },
  toggleBtnText: { color: colors.maroon, fontWeight: '700', fontSize: 13 },
  addBox: { marginTop: 10, backgroundColor: colors.bg, borderRadius: 8, padding: 10 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13, justifyContent: 'center', backgroundColor: colors.white },
  scanBtn: { borderWidth: 1, borderColor: colors.maroon, borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 8 },
  scanBtnText: { color: colors.maroon, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.maroon, borderRadius: 8, padding: 12, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontWeight: '700' },
  airconBox: { backgroundColor: colors.bg, borderRadius: 8, padding: 12 },
  vehicleMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: 10 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.maroon,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkboxDone: { backgroundColor: colors.maroon },
  checkboxMark: { color: colors.white, fontSize: 12, fontWeight: '700' },
  checklistText: { flex: 1, fontSize: 13, color: colors.text },
  checklistTextDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  checklistTime: { fontSize: 11, color: colors.textMuted },
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

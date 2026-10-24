import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import PickerModal from '../components/PickerModal';
import ListControls from '../components/ListControls';
import DateField from '../components/DateField';

const EXTINGUISHER_TYPES = ['CO2', 'Dry Chemical', 'Wet Chemical', 'Foam'].map((t) => ({ value: t, label: t }));
const CONDITION_OPTIONS = ['Operational', 'Needs Cleaning', 'Needs Repair'].map((t) => ({ value: t, label: t }));

function formatDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const COVERAGE_OPTIONS = [
  { value: null, label: 'Any coverage' },
  { value: 'has', label: 'Has extinguishers' },
  { value: 'none', label: 'No extinguishers' },
];

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'count_desc', label: 'Most extinguishers' },
];

export default function SafetyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [coverageFilter, setCoverageFilter] = useState(null);
  const [buildingFilter, setBuildingFilter] = useState(null);
  const [statFilter, setStatFilter] = useState(null); // 'attention' | 'refill' | 'overdue' | null
  const [sortBy, setSortBy] = useState('name_asc');
  const [summary, setSummary] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [extinguisherUnits, setExtinguisherUnits] = useState([]);
  const [loadingBuilding, setLoadingBuilding] = useState(false);

  const [showAddExtinguisher, setShowAddExtinguisher] = useState(false);
  const [extinguisher, setExtinguisher] = useState({ type: 'Dry Chemical', kg: '', installed: '', inspected: '', expiry: '' });
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [airconUnits, setAirconUnits] = useState([]);
  const [showAddAircon, setShowAddAircon] = useState(false);
  const [newAircon, setNewAircon] = useState({ unit_name: '', condition: 'Operational', assigned_tech: '' });
  const [conditionPickerOpen, setConditionPickerOpen] = useState(false);
  const [savingAircon, setSavingAircon] = useState(false);

  const [loading, setLoading] = useState(true);

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

  function closeBuilding() {
    setSelected(null);
    setShowAddExtinguisher(false);
    setShowAddAircon(false);
  }

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
      setAirconUnits(unit.data.units || (unit.data.unit ? [unit.data.unit] : []));
    } catch (e) {
      Alert.alert('Error loading building details', e.message);
    } finally {
      setLoadingBuilding(false);
    }
  }

  async function saveExtinguisher() {
    if (!selected) return;
    setSaving(true);
    try {
      await client.post('/safety/fire-extinguishers', {
        building: selected.key,
        ...extinguisher,
      });
      Alert.alert('Saved', 'Fire extinguisher record added.');
      setExtinguisher({ type: 'Dry Chemical', kg: '', installed: '', inspected: '', expiry: '' });
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

  async function toggleChecklistTask(aircon, task) {
    const replaceUnit = (checklist) =>
      setAirconUnits((list) => list.map((u) => (u.id === aircon.id ? { ...u, checklist } : u)));
    const updatedTasks = aircon.checklist.map((t) => {
      if (t.id !== task.id) return t;
      const done = !t.done;
      // Stamp (or clear) the actual finish date/time instead of leaving the
      // stale value from whatever the server last returned.
      return { ...t, done, completed_at: done ? new Date().toISOString() : null };
    });
    replaceUnit(updatedTasks);
    try {
      const res = await client.post(`/safety/aircon/checklist/${aircon.id}`, {
        tasks: updatedTasks.map((t) => ({ id: t.id, done: t.done })),
      });
      replaceUnit(res.data.checklist);
    } catch (e) {
      replaceUnit(aircon.checklist);
      Alert.alert('Error updating checklist', e.message);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />;

  const buildingOptions = [
    { value: null, label: 'All buildings' },
    ...buildings.map((b) => ({ value: b.key, label: b.name })),
  ];

  const visibleBuildings = buildings
    .filter((b) => !buildingFilter || b.key === buildingFilter)
    .filter((b) => {
      if (coverageFilter === 'has') return b.extinguisher_count > 0;
      if (coverageFilter === 'none') return b.extinguisher_count === 0;
      return true;
    })
    .filter((b) => {
      if (statFilter === 'attention') return b.needs_attention > 0;
      if (statFilter === 'refill') return b.due_for_refill > 0;
      if (statFilter === 'overdue') return b.overdue_inspection > 0;
      return true;
    })
    .filter((b) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return b.name.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'count_desc') return b.extinguisher_count - a.extinguisher_count;
      return a.name.localeCompare(b.name);
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>Fire safety overview</Text>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <StatCard
          value={summary?.fire_extinguishers.total ?? 0}
          label="Extinguishers"
          active={!statFilter}
          onPress={() => setStatFilter(null)}
        />
        <StatCard
          value={`${summary?.fire_extinguishers.inspection_readiness ?? 0}%`}
          label="Inspection readiness"
          active={statFilter === 'overdue'}
          onPress={() => setStatFilter((f) => (f === 'overdue' ? null : 'overdue'))}
        />
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <StatCard
          value={summary?.fire_extinguishers.needs_attention ?? 0}
          label="Needs attention"
          color={colors.danger}
          active={statFilter === 'attention'}
          onPress={() => setStatFilter((f) => (f === 'attention' ? null : 'attention'))}
        />
        <StatCard
          value={summary?.fire_extinguishers.due_for_refill ?? 0}
          label="Due for refill"
          color={colors.warning}
          active={statFilter === 'refill'}
          onPress={() => setStatFilter((f) => (f === 'refill' ? null : 'refill'))}
        />
      </View>
      <View style={styles.airconSummary}>
        <Text style={styles.airconSummaryText}>
          🌬️ {summary?.aircon.total ?? 0} aircon units · {summary?.aircon.needs_attention ?? 0} need attention
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Fire extinguisher map</Text>
      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search buildings..."
        filter={{
          value: buildingFilter,
          options: buildingOptions,
          onChange: setBuildingFilter,
          title: 'Filter by building',
          label: 'All buildings',
        }}
        filter2={{
          value: coverageFilter,
          options: COVERAGE_OPTIONS,
          onChange: setCoverageFilter,
          title: 'Filter by coverage',
          label: 'Any coverage',
        }}
        sort={{
          value: sortBy,
          options: SORT_OPTIONS,
          onChange: setSortBy,
          title: 'Sort by',
        }}
      />
      <View style={styles.grid}>
        {visibleBuildings.length === 0 ? (
          <Text style={styles.empty}>
            {search.trim() || coverageFilter || buildingFilter || statFilter
              ? 'No buildings match your current search/filters.'
              : 'No buildings registered yet.'}
          </Text>
        ) : visibleBuildings.map((b) => (
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

      <Modal visible={!!selected} animationType="slide" onRequestClose={closeBuilding}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalHeaderTitle} numberOfLines={1}>{selected?.name}</Text>
          <TouchableOpacity onPress={closeBuilding}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>

        {loadingBuilding ? (
          <View style={styles.modalBody}>
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />
          </View>
        ) : (
        <ScrollView style={styles.modalBody} contentContainerStyle={{ padding: 16 }}>
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
              <TouchableOpacity style={styles.input} onPress={() => setTypePickerOpen(true)}>
                <Text style={{ color: colors.text }}>{extinguisher.type}</Text>
              </TouchableOpacity>
              <TextInput style={styles.input} placeholder="KG capacity" keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
                value={extinguisher.kg} onChangeText={(t) => setExtinguisher({ ...extinguisher, kg: t })} />
              <DateField style={styles.input} placeholder="Date installed"
                value={extinguisher.installed} onChange={(d) => setExtinguisher({ ...extinguisher, installed: d })} />
              <DateField style={styles.input} placeholder="Date inspected"
                value={extinguisher.inspected} onChange={(d) => setExtinguisher({ ...extinguisher, inspected: d })} />
              <DateField style={styles.input} placeholder="Date of expiry"
                value={extinguisher.expiry} onChange={(d) => setExtinguisher({ ...extinguisher, expiry: d })} />

              <TouchableOpacity style={styles.saveBtn} onPress={saveExtinguisher} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save to system'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.subTitle, { marginTop: 20 }]}>Aircon unit & checklist</Text>
          {airconUnits.length > 0 ? (
            airconUnits.map((aircon) => (
            <View key={aircon.id} style={[styles.airconBox, { marginBottom: 10 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={styles.unitId}>{aircon.unit}</Text>
                <Badge status={aircon.condition} />
              </View>
              <Text style={styles.vehicleMeta}>Last cleaning: {aircon.last_cleaning || '—'} · Next schedule: {aircon.next_schedule || '—'}</Text>
              <Text style={styles.vehicleMeta}>Assigned tech: {aircon.assigned_tech || '—'}</Text>

              <View style={{ marginTop: 10 }}>
                {(aircon.checklist || []).map((task) => (
                  <TouchableOpacity key={task.id} style={styles.checklistRow} onPress={() => toggleChecklistTask(aircon, task)}>
                    <View style={[styles.checkbox, task.done && styles.checkboxDone]}>
                      {task.done && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <Text style={[styles.checklistText, task.done && styles.checklistTextDone]}>{task.task}</Text>
                    {task.completed_at && <Text style={styles.checklistTime}>{formatDateTime(task.completed_at)}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            ))
          ) : (
            <Text style={styles.empty}>No aircon unit recorded for this building yet.</Text>
          )}

          <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowAddAircon((s) => !s)}>
            <Text style={styles.toggleBtnText}>{showAddAircon ? '– Cancel' : '+ Register aircon unit'}</Text>
          </TouchableOpacity>

          {showAddAircon && (
            <View style={styles.addBox}>
              <TextInput style={styles.input} placeholder="Unit name / model"
                placeholderTextColor={colors.textMuted}
                value={newAircon.unit_name} onChangeText={(t) => setNewAircon({ ...newAircon, unit_name: t })} />
              <TouchableOpacity style={styles.input} onPress={() => setConditionPickerOpen(true)}>
                <Text style={{ color: colors.text }}>{newAircon.condition}</Text>
              </TouchableOpacity>
              <TextInput style={styles.input} placeholder="Assigned technician (optional)"
                placeholderTextColor={colors.textMuted}
                value={newAircon.assigned_tech} onChangeText={(t) => setNewAircon({ ...newAircon, assigned_tech: t })} />
              <TouchableOpacity style={styles.saveBtn} onPress={saveAirconUnit} disabled={savingAircon}>
                <Text style={styles.saveBtnText}>{savingAircon ? 'Saving...' : 'Register unit'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        )}
      </Modal>

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
    </ScrollView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  subTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  airconSummary: {
    backgroundColor: colors.infoBg, borderRadius: 8, padding: 10, marginBottom: 20,
  },
  airconSummaryText: { color: colors.info, fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  buildingCard: {
    width: '31%', backgroundColor: colors.surface, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  buildingCardActive: { borderColor: colors.maroon, backgroundColor: colors.maroonLight },
  buildingName: { fontSize: 12, fontWeight: '700', color: colors.text },
  buildingCount: { fontSize: 11, color: colors.danger, marginTop: 4 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.maroon, paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
  },
  modalHeaderTitle: { flex: 1, color: colors.white, fontWeight: '700', fontSize: 16, marginRight: 12 },
  modalCloseText: { color: colors.white, fontWeight: '600' },
  modalBody: { flex: 1, backgroundColor: colors.bg },
  unitRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  unitId: { fontWeight: '700', color: colors.text, fontSize: 13 },
  toggleBtn: { alignSelf: 'flex-start', marginTop: 10 },
  toggleBtnText: { color: colors.maroon, fontWeight: '700', fontSize: 13 },
  addBox: { marginTop: 10, backgroundColor: colors.bg, borderRadius: 8, padding: 10 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 13, justifyContent: 'center', backgroundColor: colors.surface, color: colors.text },
  saveBtn: { backgroundColor: colors.maroon, borderRadius: 8, padding: 12, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontWeight: '700' },
  airconBox: { backgroundColor: colors.bg, borderRadius: 8, padding: 12 },
  vehicleMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', width: '100%', marginVertical: 10 },
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
});

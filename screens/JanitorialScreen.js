import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';
import StatCard from '../components/StatCard';
import ListControls from '../components/ListControls';
import JanitorialHistoryModal from '../components/JanitorialHistoryModal';
import ConsumableStockModal from '../components/ConsumableStockModal';

function formatDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const STATUS_OPTIONS = [
  { value: null, label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'done', label: 'Done' },
  { value: 'missed', label: 'Missed' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest to oldest' },
  { value: 'oldest', label: 'Oldest to newest' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'status', label: 'Status' },
];

export default function JanitorialScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [floorFilter, setFloorFilter] = useState(null);
  const [sortBy, setSortBy] = useState('name_asc');
  const [zones, setZones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showConsumables, setShowConsumables] = useState(false);

  const load = useCallback(async () => {
    try {
      // GET /api/janitorial/zones -> [{ id, name, status }]
      const res = await client.get('/janitorial/zones');
      setZones(res.data.zones || []);
    } catch (e) {
      Alert.alert('Error loading zones', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function selectZone(z) {
    setSelected(z);
    try {
      // GET /api/janitorial/checklist/:zoneId -> [{ id, task, done, completed_at }]
      const res = await client.get(`/janitorial/checklist/${z.id}`);
      setChecklist(res.data.tasks || []);
    } catch (e) {
      setChecklist([]);
    }
  }

  function toggleTask(id) {
    setChecklist((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const done = !t.done;
      // Stamp (or clear) the actual finish date/time instead of leaving the
      // stale value from whatever the server last returned.
      return { ...t, done, completed_at: done ? new Date().toISOString() : null };
    }));
  }

  async function saveChecklist() {
    setSaving(true);
    try {
      // POST /api/janitorial/checklist/:zoneId  { tasks: [{id, done, completed_at}] }
      await client.post(`/janitorial/checklist/${selected.id}`, {
        tasks: checklist.map((t) => ({ id: t.id, done: t.done, completed_at: t.completed_at || null })),
      });
      Alert.alert('Saved', 'Checklist updated.');
      load();
    } catch (e) {
      Alert.alert('Error saving checklist', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />;

  const completed = zones.filter((z) => z.status === 'done').length;
  const pending = zones.filter((z) => z.status === 'pending').length;
  const missed = zones.filter((z) => z.status === 'missed').length;

  const floorOptions = [
    { value: null, label: 'All floors' },
    ...Array.from(new Set(zones.map((z) => z.floor).filter(Boolean)))
      .map((floor) => ({ value: floor, label: floor })),
  ];

  const visibleZones = zones
    .filter((z) => !statusFilter || z.status === statusFilter)
    .filter((z) => !floorFilter || z.floor === floorFilter)
    .filter((z) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return z.name.toLowerCase().includes(q) || (z.department || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return Number(b.id) - Number(a.id);
      if (sortBy === 'oldest') return Number(a.id) - Number(b.id);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'status') return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Campus cleaning zones</Text>
        <TouchableOpacity onPress={() => setShowHistory(true)}>
          <Text style={styles.historyLink}>View activity history</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <StatCard
          value={completed}
          label="Completed"
          color={colors.success}
          active={statusFilter === 'done'}
          onPress={() => setStatusFilter((f) => (f === 'done' ? null : 'done'))}
        />
        <StatCard
          value={pending}
          label="Pending"
          color={colors.warning}
          active={statusFilter === 'pending'}
          onPress={() => setStatusFilter((f) => (f === 'pending' ? null : 'pending'))}
        />
        <StatCard
          value={missed}
          label="Missed"
          color={colors.danger}
          active={statusFilter === 'missed'}
          onPress={() => setStatusFilter((f) => (f === 'missed' ? null : 'missed'))}
        />
      </View>

      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search zones..."
        filter={{
          value: statusFilter,
          options: STATUS_OPTIONS,
          onChange: setStatusFilter,
          title: 'Filter by status',
          label: 'All statuses',
        }}
        filter2={{
          value: floorFilter,
          options: floorOptions,
          onChange: setFloorFilter,
          title: 'Filter by floor',
          label: 'All floors',
        }}
        sort={{
          value: sortBy,
          options: SORT_OPTIONS,
          onChange: setSortBy,
          title: 'Sort by',
        }}
      />

      <View style={styles.grid}>
        {visibleZones.length === 0 ? (
          <Text style={styles.empty}>No zones match your search.</Text>
        ) : visibleZones.map((z) => (
          <TouchableOpacity
            key={z.id}
            style={[styles.zoneCard, selected?.id === z.id && styles.zoneCardActive]}
            onPress={() => selectZone(z)}
          >
            <Text style={styles.zoneName}>{z.name}</Text>
            {z.floor && <Text style={styles.zoneFloor}>{z.floor}</Text>}
            <Text style={[styles.zoneStatus, { color: statusColor(z.status, colors) }]}>{z.status}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selected && (
        <View style={styles.checklistBox}>
          <Text style={styles.formTitle}>{selected.name} — Daily checklist</Text>
          {checklist.map((task) => (
            <TouchableOpacity key={task.id} style={styles.taskRow} onPress={() => toggleTask(task.id)}>
              <View style={[styles.checkbox, task.done && styles.checkboxDone]}>
                {task.done && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.taskLabel}>{task.task}</Text>
              {task.completed_at && <Text style={styles.taskTime}>{formatDateTime(task.completed_at)}</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.saveBtn} onPress={saveChecklist} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save checklist'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.consumableBtn} onPress={() => setShowConsumables(true)}>
            <Text style={styles.consumableBtnText}>🧴 Report consumable stock</Text>
          </TouchableOpacity>
        </View>
      )}

      <JanitorialHistoryModal visible={showHistory} onClose={() => setShowHistory(false)} />
      <ConsumableStockModal
        visible={showConsumables}
        zone={selected}
        onClose={() => setShowConsumables(false)}
      />
    </ScrollView>
  );
}

function statusColor(status, colors) {
  if (status === 'done') return colors.success;
  if (status === 'missed') return colors.danger;
  return colors.warning;
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  historyLink: { fontSize: 12, fontWeight: '600', color: colors.maroon },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  zoneCard: {
    width: '31%', backgroundColor: colors.surface, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  zoneCardActive: { borderColor: colors.maroon, backgroundColor: colors.maroonLight },
  zoneName: { fontSize: 12, fontWeight: '700', color: colors.text },
  zoneFloor: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  zoneStatus: { fontSize: 11, marginTop: 4, textTransform: 'capitalize' },
  empty: { color: colors.textMuted, textAlign: 'center', width: '100%', marginVertical: 10 },
  checklistBox: {
    backgroundColor: colors.surface, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.maroon, marginTop: 8,
  },
  formTitle: { fontWeight: '700', color: colors.maroon, marginBottom: 10 },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: colors.maroon,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  checkboxDone: { backgroundColor: colors.maroon },
  checkmark: { color: colors.white, fontSize: 12, fontWeight: '700' },
  taskLabel: { flex: 1, fontSize: 13, color: colors.text },
  taskTime: { fontSize: 11, color: colors.textMuted },
  saveBtn: { backgroundColor: colors.maroon, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: colors.white, fontWeight: '700' },
  consumableBtn: {
    backgroundColor: colors.surface, borderRadius: 8, padding: 12, alignItems: 'center',
    marginTop: 10, borderWidth: 1, borderColor: colors.maroon,
  },
  consumableBtnText: { color: colors.maroon, fontWeight: '700', fontSize: 13 },
});

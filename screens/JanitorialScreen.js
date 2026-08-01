import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import client from '../api/client';
import StatCard from '../components/StatCard';
import colors from '../theme/colors';

export default function JanitorialScreen() {
  const [zones, setZones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      // GET /api/janitorial/checklist/:zoneId -> [{ id, task, done, time }]
      const res = await client.get(`/janitorial/checklist/${z.id}`);
      setChecklist(res.data.tasks || []);
    } catch (e) {
      setChecklist([]);
    }
  }

  function toggleTask(id) {
    setChecklist((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  async function saveChecklist() {
    setSaving(true);
    try {
      // POST /api/janitorial/checklist/:zoneId  { tasks: [{id, done}] }
      await client.post(`/janitorial/checklist/${selected.id}`, {
        tasks: checklist.map((t) => ({ id: t.id, done: t.done })),
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>Campus cleaning zones</Text>
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <StatCard value={completed} label="Completed" color={colors.success} />
        <StatCard value={pending} label="Pending" color={colors.warning} />
        <StatCard value={missed} label="Missed" color={colors.danger} />
      </View>

      <View style={styles.grid}>
        {zones.map((z) => (
          <TouchableOpacity
            key={z.id}
            style={[styles.zoneCard, selected?.id === z.id && styles.zoneCardActive]}
            onPress={() => selectZone(z)}
          >
            <Text style={styles.zoneName}>{z.name}</Text>
            <Text style={[styles.zoneStatus, { color: statusColor(z.status) }]}>{z.status}</Text>
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
              {task.time && <Text style={styles.taskTime}>{task.time}</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.saveBtn} onPress={saveChecklist} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save checklist'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function statusColor(status) {
  if (status === 'done') return colors.success;
  if (status === 'missed') return colors.danger;
  return colors.warning;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  zoneCard: {
    width: '31%', backgroundColor: colors.white, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border, marginBottom: 10,
  },
  zoneCardActive: { borderColor: colors.maroon, backgroundColor: colors.maroonLight },
  zoneName: { fontSize: 12, fontWeight: '700', color: colors.text },
  zoneStatus: { fontSize: 11, marginTop: 4, textTransform: 'capitalize' },
  checklistBox: {
    backgroundColor: colors.white, borderRadius: 10, padding: 14,
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
});

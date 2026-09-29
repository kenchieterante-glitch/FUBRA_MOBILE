import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';
import Badge from './Badge';

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function JanitorialHistoryModal({ visible, onClose }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // GET /api/janitorial/history -> [{ id, zone, task, status, completed_at }]
      const res = await client.get('/janitorial/history');
      setHistory(res.data.history || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Janitorial activity history</Text>
            <Text style={styles.headerSub}>All zones · Completed, pending & missed tasks</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : (
          <FlatList
            style={styles.list}
            data={history}
            keyExtractor={(item, i) => `${item.zone}-${item.task}-${i}`}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={styles.empty}>No janitorial activity recorded yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.entry}>
                <View style={styles.entryTop}>
                  <Text style={styles.task}>{item.task}</Text>
                  <Badge status={item.status} />
                </View>
                <Text style={styles.meta}>{item.zone}</Text>
                <Text style={styles.meta}>
                  {item.status === 'done' ? 'Completed' : item.status === 'missed' ? 'Missed' : 'Due'} {formatDateTime(item.completed_at)}
                </Text>
                {item.performed_by ? <Text style={styles.meta}>By {item.performed_by}</Text> : null}
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: colors.maroon, paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
  },
  list: { flex: 1, backgroundColor: colors.bg },
  headerTitle: { color: colors.white, fontWeight: '700', fontSize: 16 },
  headerSub: { color: colors.white, opacity: 0.8, fontSize: 12, marginTop: 2 },
  closeText: { color: colors.white, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  entry: {
    backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  task: { fontSize: 14, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

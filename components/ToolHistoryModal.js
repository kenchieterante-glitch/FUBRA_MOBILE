import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';
import Badge from './Badge';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ToolHistoryModal({ visible, tool, onClose }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [history, setHistory] = useState([]);
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!tool) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.get(`/tools/history/${encodeURIComponent(tool.asset_id)}`);
      setHistory(res.data.history || []);
      setUnit(res.data.unit || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tool]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{tool?.tool_name}</Text>
            <Text style={styles.headerSub}>{tool?.asset_id} · Borrow & return history</Text>
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
            keyExtractor={(item, i) => `${item.borrower}-${item.borrowed_date}-${i}`}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={styles.empty}>No borrow history recorded for this item yet.</Text>}
            renderItem={({ item }) => (
              <View style={styles.entry}>
                <View style={styles.entryTop}>
                  <Text style={styles.borrower}>{item.borrower}</Text>
                  <Badge status={item.status} />
                </View>
                {item.department ? <Text style={styles.meta}>{item.department}</Text> : null}
                <Text style={styles.meta}>
                  Borrowed {formatDate(item.borrowed_date)} · Due {formatDate(item.expected_return)}
                  {item.quantity != null ? ` · Qty ${item.quantity}${unit ? ` ${unit}` : ''}` : ''}
                </Text>
                {item.status === 'Returned' ? (
                  <Text style={styles.meta}>
                    Returned {formatDate(item.returned_date)}
                    {item.returned_quantity != null ? ` · Qty returned ${item.returned_quantity}${unit ? ` ${unit}` : ''}` : ''}
                    {item.condition_status ? ` · Condition: ${item.condition_status}` : ''}
                  </Text>
                ) : null}
                {item.remarks ? <Text style={styles.remarks}>“{item.remarks}”</Text> : null}
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
  borrower: { fontSize: 14, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  remarks: { fontSize: 12, color: colors.text, fontStyle: 'italic', marginTop: 6 },
});

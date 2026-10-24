import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Badge from './Badge';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const MAX_EXTEND_DAYS = 3;

export default function ToolHistoryModal({ visible, tool, onClose }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [extendingId, setExtendingId] = useState(null);
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

  // Only the borrower (or an administrator) may extend — the server enforces
  // the same rule, this just avoids offering a button that would be refused.
  const canExtend = (item) => item.can_extend && (
    String(user?.role || '').toLowerCase() === 'administrator'
    || String(item.borrower || '').toLowerCase() === String(user?.name || '').toLowerCase()
    || String(item.borrower) === String(user?.employee_id)
  );

  async function extend(item, days) {
    setExtendingId(item.id);
    try {
      const res = await client.post('/tools/extend', { borrow_id: item.id, days });
      Alert.alert('Borrow extended', res.data?.message || 'Due date updated.');
      await load();
    } catch (e) {
      Alert.alert('Could not extend', e.response?.data?.message || e.message);
    } finally {
      setExtendingId(null);
    }
  }

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
                {canExtend(item) ? (
                  <View style={styles.extendRow}>
                    <Text style={styles.extendLabel}>Need more time? Extend by</Text>
                    {Array.from({ length: MAX_EXTEND_DAYS }, (_, i) => i + 1).map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.extendBtn, extendingId === item.id && styles.extendBtnDisabled]}
                        disabled={extendingId === item.id}
                        onPress={() => extend(item, d)}
                      >
                        <Text style={styles.extendBtnText}>+{d}d</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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
  extendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 10 },
  extendLabel: { fontSize: 12, color: colors.text, marginRight: 8 },
  extendBtn: {
    backgroundColor: colors.maroon, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, marginRight: 6,
  },
  extendBtnDisabled: { opacity: 0.5 },
  extendBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  remarks: { fontSize: 12, color: colors.text, fontStyle: 'italic', marginTop: 6 },
});

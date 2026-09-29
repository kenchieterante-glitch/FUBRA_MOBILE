import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator,
  ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';

export default function ConsumableStockModal({ visible, zone, onClose }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [values, setValues] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedIds, setSavedIds] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // GET /api/janitorial/consumables -> [{ id, item_name, category, unit, current_stock, reorder_threshold, low_stock }]
      const res = await client.get('/janitorial/consumables');
      const list = res.data.items || [];
      setItems(list);
      setValues(Object.fromEntries(list.map((i) => [i.id, String(i.current_stock)])));
      setSavedIds({});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  async function submitItem(item) {
    const raw = (values[item.id] ?? '').trim();
    const qty = Number(raw);
    if (raw === '' || Number.isNaN(qty) || qty < 0) {
      Alert.alert('Invalid quantity', 'Enter the remaining quantity as a number (0 or more).');
      return;
    }

    setSavingId(item.id);
    try {
      // POST /api/janitorial/consumables/:id/report { quantity_left, zone }
      const res = await client.post(`/janitorial/consumables/${item.id}/report`, {
        quantity_left: qty,
        zone: zone?.name || null,
      });
      setItems((prev) => prev.map((i) => (
        i.id === item.id ? { ...i, current_stock: qty, low_stock: !!res.data.low_stock } : i
      )));
      setSavedIds((prev) => ({ ...prev, [item.id]: true }));
      if (res.data.low_stock) {
        if (qty <= 0) {
          Alert.alert('Zero stock reported', `${item.item_name} is out of stock. FU-UBRA has been notified.`);
        } else {
          Alert.alert('Low stock reported', `${item.item_name} is at or below its reorder threshold. FU-UBRA has been notified.`);
        }
      }
    } catch (e) {
      Alert.alert('Error saving stock level', e.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Consumable stock</Text>
            <Text style={styles.headerSub}>
              {zone?.name ? `${zone.name} · ` : ''}Enter what's left after cleaning
            </Text>
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
          <ScrollView style={styles.list} contentContainerStyle={{ padding: 16 }}>
            {items.length === 0 ? (
              <Text style={styles.empty}>No consumable items registered yet.</Text>
            ) : items.map((item) => {
              const isZero = Number(item.current_stock) <= 0;
              return (
              <View key={item.id} style={[styles.card, item.low_stock && styles.cardLow]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.item_name}</Text>
                    <Text style={styles.itemMeta}>
                      {item.category} · Reorder at {item.reorder_threshold} {item.unit}
                    </Text>
                  </View>
                  {item.low_stock && (
                    <View style={styles.lowBadge}>
                      <Text style={styles.lowBadgeText}>{isZero ? 'Zero stock' : 'Low stock'}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={values[item.id] ?? ''}
                    onChangeText={(t) => setValues((prev) => ({ ...prev, [item.id]: t }))}
                    placeholder="Qty left"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.unitLabel}>{item.unit}</Text>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => submitItem(item)}
                    disabled={savingId === item.id}
                  >
                    {savingId === item.id ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.saveBtnText}>{savedIds[item.id] ? 'Update' : 'Save'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              );
            })}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
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
  card: {
    backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  cardLow: { borderColor: colors.danger },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  lowBadge: { backgroundColor: colors.dangerBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  lowBadgeText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, color: colors.text, backgroundColor: colors.bg,
  },
  unitLabel: { fontSize: 12, color: colors.textMuted, width: 50 },
  saveBtn: { backgroundColor: colors.maroon, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
});

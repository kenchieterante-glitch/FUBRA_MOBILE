import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';

export default function StatCard({ value, label, color = colors.maroon }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: { fontSize: 22, fontWeight: '700' },
  label: { fontSize: 12, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
});

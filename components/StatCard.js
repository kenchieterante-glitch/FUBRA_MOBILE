import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function StatCard({ value, label, color, onPress, active }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.card, active && { borderColor: color || colors.maroon, backgroundColor: colors.maroonLight }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={[styles.value, { color: color || colors.maroon }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Wrapper>
  );
}

const getStyles = (colors) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
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

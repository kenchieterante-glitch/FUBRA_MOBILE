import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';

const MAP = {
  available: { bg: colors.successBg, fg: colors.success },
  done: { bg: colors.successBg, fg: colors.success },
  completed: { bg: colors.successBg, fg: colors.success },
  returned: { bg: colors.successBg, fg: colors.success },
  new: { bg: colors.successBg, fg: colors.success },
  active: { bg: colors.warningBg, fg: colors.warning },
  pending: { bg: colors.warningBg, fg: colors.warning },
  borrowed: { bg: colors.warningBg, fg: colors.warning },
  in_use: { bg: colors.warningBg, fg: colors.warning },
  refillable: { bg: colors.warningBg, fg: colors.warning },
  due_soon: { bg: colors.warningBg, fg: colors.warning },
  maintenance: { bg: colors.dangerBg, fg: colors.danger },
  missed: { bg: colors.dangerBg, fg: colors.danger },
  cancelled: { bg: colors.dangerBg, fg: colors.danger },
  rejected: { bg: colors.dangerBg, fg: colors.danger },
  disposal: { bg: colors.dangerBg, fg: colors.danger },
  defective: { bg: colors.dangerBg, fg: colors.danger },
  missing: { bg: colors.dangerBg, fg: colors.danger },
  expired: { bg: colors.dangerBg, fg: colors.danger },
  'in transit': { bg: colors.infoBg, fg: colors.info },
  in_transit: { bg: colors.infoBg, fg: colors.info },
};

export default function Badge({ status }) {
  const key = (status || '').toLowerCase().replace(/\s+/g, '_');
  const style = MAP[key] || { bg: colors.border, fg: colors.textMuted };
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.text, { color: style.fg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});

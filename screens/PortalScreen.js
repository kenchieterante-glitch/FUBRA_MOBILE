import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import appConfig from '../app.json';

export default function PortalScreen() {
  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const appVersion = appConfig?.expo?.version;

  function confirmLogout() {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: logout },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.banner}>
        {/* Purely decorative — softens the flat maroon block behind the avatar. */}
        <View style={[styles.bannerCircle, styles.bannerCircleLg]} />
        <View style={[styles.bannerCircle, styles.bannerCircleSm]} />

        <View style={styles.avatarWrap}>
          <Text style={styles.avatarInitial}>{(user?.name || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.welcome}>{user?.name || 'Staff'}</Text>
        <Text style={styles.sub}>{user?.employee_id} · {user?.department}</Text>

        <View style={styles.badgeRow}>
          {user?.role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{user.role}</Text>
            </View>
          )}
          {user?.is_guard && (
            <View style={styles.guardBadge}>
              <Text style={styles.guardBadgeText}>🛡️ Authorized guard</Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <InfoRow styles={styles} icon="🪪" label="Employee ID" value={user?.employee_id || '—'} />
          <View style={styles.divider} />
          <InfoRow styles={styles} icon="🏢" label="Department" value={user?.department || '—'} />
          {user?.role && (
            <>
              <View style={styles.divider} />
              <InfoRow styles={styles} icon="👤" label="Role" value={user.role} capitalize />
            </>
          )}
        </View>

        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconCircleText}>🌙</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Dark mode</Text>
              <Text style={styles.settingHint}>Switch how FU-UBRA looks on this device.</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.maroon }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.logout} onPress={confirmLogout}>
          <Text style={styles.logoutText}>🚪  Sign out</Text>
        </TouchableOpacity>

        {!!appVersion && (
          <Text style={styles.footer}>FU-UBRA · Foundation University · v{appVersion}</Text>
        )}
      </View>
    </ScrollView>
  );
}

// Same "pass the parent's theme-aware styles down" pattern already used by
// TelemetryStat in VehicleTrackingModal.js — keeps this row on the current
// theme instead of a static stylesheet that would ignore dark mode.
function InfoRow({ styles, icon, label, value, capitalize }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconCircleText}>{icon}</Text>
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, capitalize && { textTransform: 'capitalize' }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  banner: {
    backgroundColor: colors.maroon, alignItems: 'center', paddingTop: 36, paddingBottom: 24,
    paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  bannerCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  bannerCircleLg: { width: 180, height: 180, top: -70, right: -50 },
  bannerCircleSm: { width: 90, height: 90, bottom: -30, left: -20 },
  avatarWrap: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarInitial: { color: colors.maroon, fontSize: 32, fontWeight: '800' },
  welcome: { fontSize: 20, fontWeight: '800', color: colors.white, textAlign: 'center' },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, textAlign: 'center' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  roleBadgeText: { color: colors.white, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  guardBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  guardBadgeText: { color: colors.white, fontWeight: '600', fontSize: 12 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 8, marginTop: 22,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  divider: { height: 1, backgroundColor: colors.border },
  iconCircle: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.maroonLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  iconCircleText: { fontSize: 15 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  infoLabel: { flex: 1, fontSize: 13, color: colors.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.text, maxWidth: '50%' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  settingHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  logout: {
    marginTop: 24, alignItems: 'center', backgroundColor: colors.dangerBg,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.danger,
  },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: 11, marginTop: 18 },
});

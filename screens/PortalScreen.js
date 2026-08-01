import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

export default function PortalScreen() {
  const { user, logout } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarInitial}>{(user?.name || '?').charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.welcome}>{user?.name || 'Staff'}</Text>
      <Text style={styles.sub}>{user?.employee_id} · {user?.department}</Text>

      {user?.is_guard && (
        <View style={styles.guardBadge}>
          <Text style={styles.guardBadgeText}>🛡️ Authorized guard</Text>
        </View>
      )}

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  avatarWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.maroon,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14,
  },
  avatarInitial: { color: colors.white, fontSize: 28, fontWeight: '800' },
  welcome: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 20, textAlign: 'center' },
  guardBadge: {
    alignSelf: 'center', backgroundColor: colors.maroonLight, borderColor: colors.maroon,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 20,
  },
  guardBadgeText: { color: colors.maroon, fontWeight: '600', fontSize: 13 },
  logout: { marginTop: 12, alignItems: 'center', backgroundColor: colors.white, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border },
  logoutText: { color: colors.maroon, fontWeight: '700' },
});

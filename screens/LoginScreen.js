import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!employeeId || !password) {
      Alert.alert('Missing info', 'Enter your Employee ID and password.');
      return;
    }
    setLoading(true);
    try {
      await login(employeeId, password);
      // Navigation handles the redirect automatically once `user` is set.
    } catch (e) {
      Alert.alert('Sign in failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.logoCircle}>
        <Text style={styles.logoText}>FU</Text>
      </View>
      <Text style={styles.title}>FU-UBRA</Text>
      <Text style={styles.subtitle}>Foundation University</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Employee ID</Text>
        <TextInput
          style={styles.input}
          placeholder="EMP-2024-089"
          placeholderTextColor="#c9a9aa"
          autoCapitalize="characters"
          value={employeeId}
          onChangeText={setEmployeeId}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#c9a9aa"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.maroon} /> : <Text style={styles.buttonText}>Sign in</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.scanRow}>
          <Text style={styles.scanText}>⬛ Or scan your campus ID to login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoText: { color: colors.maroon, fontWeight: '800', fontSize: 22 },
  title: { color: colors.white, fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#e9c8c9', fontSize: 13, marginBottom: 28 },
  form: { width: '100%', maxWidth: 360 },
  label: { color: '#f0d5d6', fontSize: 12, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8, padding: 12, color: colors.white, fontSize: 15,
  },
  button: {
    backgroundColor: colors.white, borderRadius: 8, padding: 14,
    alignItems: 'center', marginTop: 24,
  },
  buttonText: { color: colors.maroon, fontWeight: '700', fontSize: 15 },
  scanRow: { alignItems: 'center', marginTop: 16 },
  scanText: { color: '#f0d5d6', fontSize: 12 },
});

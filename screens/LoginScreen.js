import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
  ImageBackground,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

// Cover every common badge/card format — campus IDs print numeric codes in all
// sorts of symbologies (Code128, EAN-8, ITF, etc.), so don't guess which one.
const ID_BARCODE_TYPES = ['qr', 'pdf417', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'codabar'];

// Campus IDs are purely numeric, so a misread that comes back with a letter
// in it (e.g. "204G07") or all-zeros/repeated digits ("000000") is noise from
// glare/fabric/edges, not a real code — reject it and keep scanning instead
// of sending garbage to the server.
function isPlausibleScan(code) {
  const trimmed = (code || '').trim();
  if (!/^\d{6,10}$/.test(trimmed)) return false; // digits only, ID-length range
  if (/^(\d)\1*$/.test(trimmed)) return false; // e.g. "000000", "111111"
  return true;
}

export default function LoginScreen() {
  const { login, loginWithScan } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(0.2);
  const [manualCode, setManualCode] = useState('');
  const [permission, requestPermission] = useCameraPermissions();

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

  async function openIdScanner() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission needed', 'Enable camera access to scan your campus ID.');
        return;
      }
    }
    setTorch(false);
    setZoom(0.2);
    setManualCode('');
    setScanning(true);
  }

  async function submitScannedCode(code) {
    setScanning(false);
    try {
      await loginWithScan(code);
      // Navigation handles the redirect automatically once `user` is set.
    } catch (e) {
      // Temporary debug line — shows exactly what the scanner read off the
      // card so we can see why it didn't match a user, then match on it.
      Alert.alert('Scan sign-in failed', `${e.message}\n\nScanned value: "${code}"`);
    }
  }

  function handleIdScanned({ data }) {
    // Ignore obvious misreads (false-positive glare/texture scans) and keep
    // the camera open instead of surfacing an error for noise.
    if (!isPlausibleScan(data)) return;
    submitScannedCode(data);
  }

  function handleManualCodeSubmit() {
    const code = manualCode.trim();
    if (!code) {
      Alert.alert('Missing info', 'Type the number printed on your campus ID.');
      return;
    }
    submitScannedCode(code);
  }

  return (
    <ImageBackground
      source={require('../assets/FUBackground.jpg')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
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

        <TouchableOpacity style={styles.scanRow} onPress={openIdScanner}>
          <Text style={styles.scanText}>⬛ Or scan your campus ID to login</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={scanning} animationType="slide">
        <CameraView
          style={{ flex: 1 }}
          enableTorch={torch}
          zoom={zoom}
          onBarcodeScanned={handleIdScanned}
          barcodeScannerSettings={{ barcodeTypes: ID_BARCODE_TYPES }}
        />
        <View style={styles.scanFrame} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <View style={styles.scannerHint}>
          <Text style={styles.scannerHintText}>Line the barcode up inside the frame</Text>
        </View>
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.controlBtn} onPress={() => setZoom((z) => Math.max(0, +(z - 0.1).toFixed(2)))}>
            <Text style={styles.controlBtnText}>－ zoom</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={() => setTorch((t) => !t)}>
            <Text style={styles.controlBtnText}>{torch ? '💡 flash on' : '🔦 flash off'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={() => setZoom((z) => Math.min(1, +(z + 0.1).toFixed(2)))}>
            <Text style={styles.controlBtnText}>＋ zoom</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.manualFallback}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Text style={styles.manualFallbackLabel}>Camera not reading it? Type the ID number instead:</Text>
          <View style={styles.manualFallbackRow}>
            <TextInput
              style={styles.manualFallbackInput}
              placeholder="20230407"
              placeholderTextColor="#c9a9aa"
              autoCapitalize="characters"
              value={manualCode}
              onChangeText={setManualCode}
              onSubmitEditing={handleManualCodeSubmit}
            />
            <TouchableOpacity style={styles.manualFallbackBtn} onPress={handleManualCodeSubmit}>
              <Text style={styles.manualFallbackBtnText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <TouchableOpacity style={styles.closeScanner} onPress={() => setScanning(false)}>
          <Text style={{ color: colors.white, fontWeight: '600' }}>Cancel scan</Text>
        </TouchableOpacity>
      </Modal>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(122, 20, 23, 0.45)',
  },
  container: {
    flex: 1,
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
  closeScanner: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: colors.maroon, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24,
  },
  controlsRow: {
    position: 'absolute', bottom: 230, alignSelf: 'center',
    flexDirection: 'row', gap: 10,
  },
  controlBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
  },
  controlBtnText: { color: colors.white, fontWeight: '600', fontSize: 12 },
  manualFallback: {
    position: 'absolute', bottom: 90, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 14, padding: 14,
  },
  manualFallbackLabel: { color: colors.white, fontSize: 12, marginBottom: 8, textAlign: 'center' },
  manualFallbackRow: { flexDirection: 'row', gap: 8 },
  manualFallbackInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.white, fontSize: 14,
  },
  manualFallbackBtn: {
    backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center',
  },
  manualFallbackBtnText: { color: colors.maroon, fontWeight: '700', fontSize: 13 },
  scannerHint: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  scannerHintText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  scanFrame: {
    position: 'absolute', top: '50%', left: '50%',
    width: 260, height: 160, marginLeft: -130, marginTop: -80,
  },
  corner: {
    position: 'absolute', width: 32, height: 32, borderColor: colors.white,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
});

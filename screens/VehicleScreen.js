import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import PickerModal from '../components/PickerModal';
import colors from '../theme/colors';

export default function VehicleScreen() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [tripTicket, setTripTicket] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newVehicle, setNewVehicle] = useState({ vehicle_name: '', plate_no: '', type: '', driver_id: null, driver_name: '', department_id: null, department_name: '' });
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(null); // 'driver' | 'department' | null
  const [scanMode, setScanMode] = useState(null); // 'in' | 'out' | null
  const [permission, requestPermission] = useCameraPermissions();

  const load = useCallback(async () => {
    try {
      const res = await client.get('/vehicles');
      setVehicles(res.data.vehicles || []);
      const meta = await client.get('/vehicles/meta');
      setDrivers(meta.data.drivers || []);
      setDepartments(meta.data.departments || []);
      const t = await client.get('/trip-tickets/next', { params: { employee_id: user?.employee_id } });
      setTripTicket(t.data.ticket || null);
    } catch (e) {
      Alert.alert('Error loading vehicles', e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function saveVehicle() {
    if (!newVehicle.vehicle_name || !newVehicle.plate_no) {
      Alert.alert('Missing info', 'Vehicle name and plate number are required.');
      return;
    }
    setSaving(true);
    try {
      await client.post('/vehicles', {
        vehicle_name: newVehicle.vehicle_name,
        plate_no: newVehicle.plate_no,
        type: newVehicle.type,
        driver_id: newVehicle.driver_id,
        department_id: newVehicle.department_id,
      });
      setNewVehicle({ vehicle_name: '', plate_no: '', type: '', driver_id: null, driver_name: '', department_id: null, department_name: '' });
      load();
      Alert.alert('Saved', 'Vehicle added to the fleet.');
    } catch (e) {
      Alert.alert('Error saving vehicle', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function openScanner(direction) {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera permission needed', 'Enable camera access to scan trip tickets.');
        return;
      }
    }
    setScanMode(direction);
  }

  async function handleScanned({ data }) {
    setScanMode(null);
    if (!tripTicket) return;
    try {
      await client.post(`/trip-tickets/${tripTicket.id}/scan-${scanMode}`, { code: data });
      load();
    } catch (e) {
      Alert.alert('Scan failed', e.message);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.sectionTitle}>Registered vehicles</Text>
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <StatCard value={vehicles.length} label="Vehicles in fleet" />
        <StatCard value={vehicles.filter(v => v.availability === 'In Use').length} label="In use" />
        <StatCard value={vehicles.filter(v => v.availability === 'Maintenance').length} label="Maintenance" color={colors.warning} />
      </View>

      {vehicles.map((v) => (
        <View key={v.plate} style={styles.vehicleCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={styles.vehicleName}>{v.name}</Text>
            <Badge status={v.availability} />
          </View>
          <Text style={styles.vehicleMeta}>{v.plate} · {v.type}</Text>
          <Text style={styles.vehicleMeta}>Driver: {v.driver || '—'} · {v.department || '—'}</Text>
          <Text style={styles.vehicleMeta}>GPS: {v.gps_status} · Inspection: {v.inspection_status}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Add vehicle</Text>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Vehicle brand / name"
          value={newVehicle.vehicle_name}
          onChangeText={(t) => setNewVehicle({ ...newVehicle, vehicle_name: t })}
        />
        <TextInput
          style={styles.input}
          placeholder="Plate number"
          value={newVehicle.plate_no}
          onChangeText={(t) => setNewVehicle({ ...newVehicle, plate_no: t })}
        />
        <TextInput
          style={styles.input}
          placeholder="Type (e.g. 4x4 utility truck)"
          value={newVehicle.type}
          onChangeText={(t) => setNewVehicle({ ...newVehicle, type: t })}
        />
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setPickerOpen('driver')}>
          <Text style={styles.pickerBtnText}>{newVehicle.driver_name || 'Select driver (optional)'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pickerBtn} onPress={() => setPickerOpen('department')}>
          <Text style={styles.pickerBtnText}>{newVehicle.department_name || 'Select department (optional)'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={saveVehicle} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save vehicle'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Driver trip ticket</Text>
      {tripTicket ? (
        <View style={styles.ticketCard}>
          <Text style={styles.ticketId}>Trip ticket #{tripTicket.ticket_no}</Text>
          <Text style={styles.vehicleMeta}>Driver: {tripTicket.driver} · Vehicle: {tripTicket.vehicle}</Text>
          <Text style={styles.vehicleMeta}>Destination: {tripTicket.destination}</Text>
          <Text style={styles.vehicleMeta}>{tripTicket.departure} – {tripTicket.return_time}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity style={styles.scanIn} onPress={() => openScanner('in')}>
              <Text style={styles.scanInText}>⧉ Scan in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scanOut} onPress={() => openScanner('out')}>
              <Text style={styles.scanOutText}>⧉ Scan out</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>No active trip ticket assigned right now.</Text>
      )}

      <PickerModal
        visible={pickerOpen === 'driver'}
        title="Select driver"
        options={drivers}
        onClose={() => setPickerOpen(null)}
        onSelect={(item) => { setNewVehicle({ ...newVehicle, driver_id: item.id, driver_name: item.name }); setPickerOpen(null); }}
      />
      <PickerModal
        visible={pickerOpen === 'department'}
        title="Select department"
        options={departments}
        onClose={() => setPickerOpen(null)}
        onSelect={(item) => { setNewVehicle({ ...newVehicle, department_id: item.id, department_name: item.name }); setPickerOpen(null); }}
      />

      <Modal visible={!!scanMode} animationType="slide">
        <CameraView
          style={{ flex: 1 }}
          onBarcodeScanned={handleScanned}
          barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'upc_a'] }}
        />
        <View style={styles.scannerHint}>
          <Text style={styles.scannerHintText}>Scan the driver's ID barcode</Text>
        </View>
        <TouchableOpacity style={styles.closeScanner} onPress={() => setScanMode(null)}>
          <Text style={{ color: colors.white, fontWeight: '600' }}>Cancel scan</Text>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10, marginTop: 8 },
  vehicleCard: {
    backgroundColor: colors.white, borderRadius: 10, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  vehicleName: { fontWeight: '700', color: colors.text, fontSize: 14 },
  vehicleMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  form: { backgroundColor: colors.white, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 10, marginBottom: 10, fontSize: 13,
  },
  pickerBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 10, marginBottom: 10,
  },
  pickerBtnText: { fontSize: 13, color: colors.text },
  saveBtn: { backgroundColor: colors.maroon, borderRadius: 8, padding: 12, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontWeight: '700' },
  ticketCard: {
    backgroundColor: colors.white, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.maroon,
  },
  ticketId: { color: colors.maroon, fontWeight: '700', marginBottom: 4 },
  scanIn: { flex: 1, backgroundColor: colors.successBg, borderRadius: 8, padding: 10, alignItems: 'center' },
  scanInText: { color: colors.success, fontWeight: '700' },
  scanOut: { flex: 1, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 10, alignItems: 'center' },
  scanOutText: { color: colors.danger, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: 10 },
  closeScanner: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: colors.maroon, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24,
  },
  scannerHint: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  scannerHintText: { color: colors.white, fontWeight: '600', fontSize: 13 },
});

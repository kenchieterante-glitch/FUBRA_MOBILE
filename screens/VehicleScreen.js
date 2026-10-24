import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import PickerModal from '../components/PickerModal';
import ListControls from '../components/ListControls';
import VehicleTrackingModal from '../components/VehicleTrackingModal';

const AVAILABILITY_OPTIONS = [
  { value: null, label: 'All statuses' },
  { value: 'Available', label: 'Available' },
  { value: 'In Use', label: 'In Use' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Reserved', label: 'Reserved' },
  { value: 'Inactive', label: 'Inactive' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest to oldest' },
  { value: 'oldest', label: 'Oldest to newest' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'status', label: 'Status' },
];

export default function VehicleScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState(null);
  const [wheelFilter, setWheelFilter] = useState(null); // 4 | 2 | null
  const [sortBy, setSortBy] = useState('name_asc');
  const [vehicles, setVehicles] = useState([]);
  const [tripTicket, setTripTicket] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newVehicle, setNewVehicle] = useState({ vehicle_name: '', plate_no: '', type: '', driver_id: null, driver_name: '', department_id: null, department_name: '' });
  const [saving, setSaving] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(null); // 'driver' | 'department' | null
  const [scanMode, setScanMode] = useState(null); // 'in' | 'out' | null
  const [permission, requestPermission] = useCameraPermissions();
  const [trackingVehicle, setTrackingVehicle] = useState(null);

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
      setShowAddVehicle(false);
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

  const wheelCounts = {
    4: vehicles.filter((v) => v.wheels === 4).length,
    2: vehicles.filter((v) => v.wheels === 2).length,
  };

  const visibleVehicles = (sortBy === 'oldest' ? [...vehicles].reverse() : vehicles)
    .filter((v) => !availabilityFilter || v.availability === availabilityFilter)
    .filter((v) => !wheelFilter || v.wheels === wheelFilter)
    .filter((v) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.plate.toLowerCase().includes(q) ||
        (v.driver || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      // API returns newest first (vehicles.id DESC); sort is stable, so keep that order.
      if (sortBy === 'newest' || sortBy === 'oldest') return 0;
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'status') return a.availability.localeCompare(b.availability) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Registered vehicles</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddVehicle(true)}>
          <Text style={styles.addBtnText}>+ Add vehicle</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <StatCard
          value={vehicles.filter(v => v.availability === 'Available').length}
          label="Available"
          color={colors.success}
          active={availabilityFilter === 'Available'}
          onPress={() => setAvailabilityFilter((f) => (f === 'Available' ? null : 'Available'))}
        />
        <StatCard
          value={vehicles.filter(v => v.availability === 'In Use').length}
          label="In use"
          active={availabilityFilter === 'In Use'}
          onPress={() => setAvailabilityFilter((f) => (f === 'In Use' ? null : 'In Use'))}
        />
        <StatCard
          value={vehicles.filter(v => v.availability === 'Maintenance').length}
          label="Maintenance"
          color={colors.warning}
          active={availabilityFilter === 'Maintenance'}
          onPress={() => setAvailabilityFilter((f) => (f === 'Maintenance' ? null : 'Maintenance'))}
        />
      </View>

      <View style={styles.wheelRow}>
        {[{ wheels: 4, label: '4 Wheels' }, { wheels: 2, label: '2 Wheels' }].map(({ wheels, label }) => {
          const active = wheelFilter === wheels;
          return (
            <TouchableOpacity
              key={wheels}
              style={[styles.wheelChip, active && styles.wheelChipActive]}
              onPress={() => setWheelFilter((f) => (f === wheels ? null : wheels))}
            >
              <Text style={[styles.wheelChipText, active && styles.wheelChipTextActive]}>{label}</Text>
              <View style={[styles.wheelChipCount, active && styles.wheelChipCountActive]}>
                <Text style={[styles.wheelChipCountText, active && styles.wheelChipCountTextActive]}>
                  {wheelCounts[wheels]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ListControls
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search vehicles..."
        filter={{
          value: availabilityFilter,
          options: AVAILABILITY_OPTIONS,
          onChange: setAvailabilityFilter,
          title: 'Filter by status',
          label: 'All statuses',
        }}
        sort={{
          value: sortBy,
          options: SORT_OPTIONS,
          onChange: setSortBy,
          title: 'Sort by',
        }}
      />

      {visibleVehicles.length === 0 ? (
        <Text style={styles.empty}>No vehicles match your search.</Text>
      ) : visibleVehicles.map((v) => (
        <View key={v.plate} style={styles.vehicleCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={styles.vehicleName}>{v.name}</Text>
            <Badge status={v.availability} />
          </View>
          <Text style={styles.vehicleMeta}>{v.plate} · {v.type}</Text>
          <Text style={styles.vehicleMeta}>Driver: {v.driver || '—'} · {v.department || '—'}</Text>
          <Text style={styles.vehicleMeta}>GPS: {v.gps_status} · Inspection: {v.inspection_status}</Text>
          <TouchableOpacity style={styles.trackBtn} onPress={() => setTrackingVehicle(v)}>
            <Text style={styles.trackBtnText}>📍 Track vehicle</Text>
          </TouchableOpacity>
        </View>
      ))}

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

      <Modal visible={showAddVehicle} animationType="fade" transparent onRequestClose={() => setShowAddVehicle(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity
            style={styles.addBackdrop}
            activeOpacity={1}
            onPress={() => setShowAddVehicle(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.addSheet}>
              <Text style={styles.addSheetTitle}>Add vehicle</Text>
              <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Vehicle brand / name"
                  placeholderTextColor={colors.textMuted}
                  value={newVehicle.vehicle_name}
                  onChangeText={(t) => setNewVehicle({ ...newVehicle, vehicle_name: t })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Plate number"
                  placeholderTextColor={colors.textMuted}
                  value={newVehicle.plate_no}
                  onChangeText={(t) => setNewVehicle({ ...newVehicle, plate_no: t })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Type (e.g. 4x4 utility truck)"
                  placeholderTextColor={colors.textMuted}
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
              </ScrollView>
              <TouchableOpacity style={styles.addCancel} onPress={() => setShowAddVehicle(false)} disabled={saving}>
                <Text style={styles.addCancelText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

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

      <VehicleTrackingModal
        visible={!!trackingVehicle}
        vehicle={trackingVehicle}
        onClose={() => setTrackingVehicle(null)}
      />
    </ScrollView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10, marginTop: 8 },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 14,
  },
  addBtn: { backgroundColor: colors.maroon, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  addBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  addSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 16, maxHeight: '85%',
  },
  addSheetTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  addCancel: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  addCancelText: { color: colors.maroon, fontWeight: '600' },
  wheelRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  wheelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  wheelChipActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  wheelChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  wheelChipTextActive: { color: colors.white },
  wheelChipCount: {
    backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 6, minWidth: 20, alignItems: 'center',
  },
  wheelChipCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  wheelChipCountText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  wheelChipCountTextActive: { color: colors.white },
  vehicleCard: {
    backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  vehicleName: { fontWeight: '700', color: colors.text, fontSize: 14 },
  vehicleMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  form: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 10, marginBottom: 10, fontSize: 13, color: colors.text,
  },
  pickerBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 10, marginBottom: 10,
  },
  pickerBtnText: { fontSize: 13, color: colors.text },
  saveBtn: { backgroundColor: colors.maroon, borderRadius: 8, padding: 12, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontWeight: '700' },
  ticketCard: {
    backgroundColor: colors.surface, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: colors.maroon,
  },
  ticketId: { color: colors.maroon, fontWeight: '700', marginBottom: 4 },
  trackBtn: {
    alignSelf: 'flex-start', backgroundColor: colors.infoBg, borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10, marginTop: 8,
  },
  trackBtnText: { color: colors.info, fontSize: 12, fontWeight: '700' },
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

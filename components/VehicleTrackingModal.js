import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';

const POLL_INTERVAL_MS = 15000;
const OFFLINE_AFTER_MS = 2 * 60 * 1000;

function timeAgo(iso) {
  if (!iso) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

// General cold-tire guideline for standard passenger/light vehicles
// (~30-35 PSI) — not vehicle-specific, just enough to flag something worth
// a look.
function psiStatus(psi, colors) {
  if (psi === null || psi === undefined) return { label: '—', color: colors.textMuted };
  if (psi < 28) return { label: 'Low', color: colors.danger };
  if (psi > 38) return { label: 'High', color: colors.warning };
  return { label: 'Normal', color: colors.success };
}

export default function VehicleTrackingModal({ visible, vehicle, onClose }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const pollRef = useRef(null);

  const fetchPosition = useCallback(async () => {
    if (!vehicle) return;
    try {
      const res = await client.get(`/vehicles/${encodeURIComponent(vehicle.plate)}/location`);
      setPosition(res.data);
      setError(null);
      mapRef.current?.animateToRegion(
        { latitude: res.data.lat, longitude: res.data.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [vehicle]);

  useEffect(() => {
    if (!visible || !vehicle) return;
    setLoading(true);
    setPosition(null);
    fetchPosition();
    pollRef.current = setInterval(fetchPosition, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [visible, vehicle, fetchPosition]);

  const online = !!position && Date.now() - new Date(position.last_update).getTime() < OFFLINE_AFTER_MS;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{vehicle?.name}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.fill}>
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />
        </View>
      ) : error ? (
        <View style={styles.fill}>
          <Text style={styles.empty}>{error}</Text>
        </View>
      ) : (
        <>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            mapType="hybrid"
            initialRegion={{
              latitude: position.lat,
              longitude: position.lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker
              coordinate={{ latitude: position.lat, longitude: position.lng }}
              title={vehicle?.name}
              description={vehicle?.plate}
              anchor={{ x: 0.5, y: 0.5 }}
            />
          </MapView>

          <View style={styles.telemetry}>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.danger }]} />
              <Text style={styles.statusText}>{online ? 'Online' : 'Offline'} · updated {timeAgo(position.last_update)}</Text>
            </View>
            <View style={styles.grid}>
              <TelemetryStat styles={styles} label="Speed" value={position.speed_kmh != null ? `${position.speed_kmh} km/h` : '—'} />
              <TelemetryStat
                styles={styles}
                label="Ignition"
                value={position.ignition == null ? '—' : (position.ignition ? 'On' : 'Off')}
                color={position.ignition == null ? undefined : (position.ignition ? colors.success : colors.textMuted)}
              />
              <TelemetryStat
                styles={styles}
                label="Motion"
                value={position.motion == null ? '—' : (position.motion ? 'Moving' : 'Stopped')}
                color={position.motion ? colors.success : undefined}
              />
              <TelemetryStat styles={styles} label="Odometer" value={position.odometer_km != null ? `${position.odometer_km} km` : '—'} />
              <TelemetryStat
                styles={styles}
                label="Tire pressure"
                value={position.tire_pressure_psi != null ? `${position.tire_pressure_psi} PSI (${psiStatus(position.tire_pressure_psi, colors).label})` : '—'}
                color={psiStatus(position.tire_pressure_psi, colors).color}
              />
              <TelemetryStat styles={styles} label="Inspection" value={position.inspection_status || '—'} />
              <TelemetryStat styles={styles} label="Availability" value={position.availability || '—'} />
              <TelemetryStat styles={styles} label="Device ID" value={position.device_id || '—'} />
            </View>
          </View>
        </>
      )}
    </Modal>
  );
}

function TelemetryStat({ styles, label, value, color }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.maroon, paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
  },
  headerTitle: { color: colors.white, fontWeight: '700', fontSize: 16 },
  closeText: { color: colors.white, fontWeight: '600' },
  fill: { flex: 1, backgroundColor: colors.bg },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  telemetry: {
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
    padding: 16, paddingBottom: 28,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '50%', marginBottom: 12 },
  statValue: { color: colors.text, fontWeight: '700', fontSize: 16 },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});

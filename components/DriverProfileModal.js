import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';
import Badge from './Badge';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DriverProfileModal({ visible, driverId, onClose }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.get(`/guard/drivers/${driverId}`);
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (visible) load();
    else setData(null);
  }, [visible, load]);

  const Row = ({ label, value }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );

  const d = data?.driver;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{d?.full_name || 'Driver'}</Text>
            <Text style={styles.headerSub}>{d?.emp_id ? `${d.emp_id} · Driver profile` : 'Driver profile'}</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.maroon} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : d ? (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personnel record</Text>
              <Row label="Status" value={d.status} />
              <Row label="Department" value={d.department} />
              <Row label="Position" value={d.position} />
              <Row label="Employment type" value={d.employment_type} />
              <Row label="Assigned task" value={d.assigned_task} />
              <Row label="Contact number" value={d.contact_number} />
              <Row label="Email" value={d.email} />
              <Row label="On record since" value={formatDate(d.since)} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Current assignment</Text>
              {data.assignment ? (
                <>
                  <Row label="Job order" value={data.assignment.job_order} />
                  <Row label="Position" value={data.assignment.position} />
                  <Row label="Location" value={data.assignment.location} />
                  <Row label="Supervisor" value={data.assignment.supervisor} />
                  <Row label="Period" value={`${formatDate(data.assignment.start)} – ${formatDate(data.assignment.end)}`} />
                </>
              ) : <Text style={styles.muted}>No active assignment.</Text>}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contract</Text>
              {data.contracts?.length ? data.contracts.map((c, i) => (
                <View key={i} style={styles.item}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemTitle}>{c.number || 'Contract'}</Text>
                    <Badge status={c.status} />
                  </View>
                  <Text style={styles.muted}>{formatDate(c.start)} – {formatDate(c.end)}{c.renewal ? ` · Renewal: ${c.renewal}` : ''}</Text>
                  {c.remarks ? <Text style={styles.muted}>{c.remarks}</Text> : null}
                </View>
              )) : <Text style={styles.muted}>No contract on file.</Text>}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Documents</Text>
              {data.documents?.length ? data.documents.map((doc, i) => (
                <View key={i} style={styles.item}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemTitle}>{doc.type || 'Document'}</Text>
                    <Badge status={doc.status} />
                  </View>
                  <Text style={styles.muted}>
                    {doc.number ? `No. ${doc.number} · ` : ''}Issued {formatDate(doc.issued)} · Expires {formatDate(doc.expires)}
                  </Text>
                </View>
              )) : <Text style={styles.muted}>No documents on file.</Text>}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent trips</Text>
              {data.trips?.length ? data.trips.map((t) => (
                <View key={t.trip_id} style={styles.item}>
                  <View style={styles.itemTop}>
                    <Text style={styles.itemTitle}>{t.trip_id}</Text>
                    <Badge status={t.status} />
                  </View>
                  <Text style={styles.muted}>{formatDate(t.date)} · {t.destination}</Text>
                  <Text style={styles.muted}>{t.vehicle}</Text>
                </View>
              )) : <Text style={styles.muted}>No trips assigned yet.</Text>}
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: colors.maroon, paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
  },
  headerTitle: { color: colors.white, fontWeight: '700', fontSize: 16 },
  headerSub: { color: colors.white, opacity: 0.8, fontSize: 12, marginTop: 2 },
  closeText: { color: colors.white, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  card: {
    backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.maroon, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { fontSize: 12, color: colors.textMuted, flex: 1 },
  rowValue: { fontSize: 12, color: colors.text, fontWeight: '600', flex: 1.4, textAlign: 'right' },
  item: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  muted: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

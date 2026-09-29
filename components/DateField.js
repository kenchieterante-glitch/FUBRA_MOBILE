import React, { useState, useMemo } from 'react';
import { Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';

// Stored/passed around as a plain YYYY-MM-DD string (what the API expects),
// parsed as local midnight so it round-trips without drifting a day from
// timezone conversion.
function parseDateOnly(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Tappable field that opens the native date picker instead of a raw text
// input — Android shows its own dialog (auto-dismisses on pick/cancel);
// iOS has no built-in dismiss action for the inline spinner, so it's staged
// in a small sheet with a Done button.
export default function DateField({ value, onChange, placeholder, style }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);

  function openPicker() {
    setDraft(parseDateOnly(value) || new Date());
    setOpen(true);
  }

  function handleChange(event, selectedDate) {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && selectedDate) {
        onChange(formatDateOnly(selectedDate));
      }
      return;
    }
    if (selectedDate) setDraft(selectedDate);
  }

  function confirmIOS() {
    if (draft) onChange(formatDateOnly(draft));
    setOpen(false);
  }

  return (
    <>
      <TouchableOpacity style={style} onPress={openPicker}>
        <Text style={value ? { color: colors.text } : { color: colors.textMuted }}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>

      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={draft || new Date()}
          mode="date"
          display="default"
          themeVariant={isDark ? 'dark' : 'light'}
          onChange={handleChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
            <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
              <DateTimePicker
                value={draft || new Date()}
                mode="date"
                display="spinner"
                themeVariant={isDark ? 'dark' : 'light'}
                onChange={handleChange}
              />
              <TouchableOpacity style={styles.doneBtn} onPress={confirmIOS}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const getStyles = (colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  doneBtn: { backgroundColor: colors.maroon, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 10 },
  doneBtnText: { color: colors.white, fontWeight: '700' },
});

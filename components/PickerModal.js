import React, { useMemo } from 'react';
import { Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Modal's animationType="slide" moves its entire content tree — including the
// dark backdrop — up from off-screen, which reads as the backdrop itself
// sliding into place instead of just dimming in. "fade" animates opacity only
// (no translation), which gives a smooth, non-jarring transition for both the
// backdrop and the sheet together. The backdrop is a flex:1/justify-flex-end
// TouchableOpacity (not absolute positioning) — the simplest, most reliable
// way to dock a sheet to the bottom and close on an outside tap.
export default function PickerModal({ visible, title, options, onSelect, onClose }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => String(item.id ?? item.value ?? item.label)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => onSelect(item)}>
                <Text style={styles.rowText}>{item.name ?? item.label}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No options available.</Text>}
          />
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const getStyles = (colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { fontSize: 14, color: colors.text },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  cancel: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: colors.maroon, fontWeight: '600' },
});

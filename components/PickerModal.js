import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import colors from '../theme/colors';

export default function PickerModal({ visible, title, options, onSelect, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '70%' },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowText: { fontSize: 14, color: colors.text },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  cancel: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: colors.maroon, fontWeight: '600' },
});

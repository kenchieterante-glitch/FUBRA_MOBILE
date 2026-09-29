import React, { useState, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import PickerModal from './PickerModal';

// Shared search + filter + sort bar used across every tab so list screens
// behave consistently. `filter`/`sort` are optional — pass only what a
// screen's data actually supports.
export default function ListControls({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filter,
  filter2,
  sort,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [openPicker, setOpenPicker] = useState(null); // 'filter' | 'filter2' | 'sort' | null

  const filterActive = !!filter && filter.value != null;
  const filterLabel = filterActive
    ? (filter.options.find((o) => o.value === filter.value)?.label ?? filter.label ?? 'Filter')
    : (filter?.label ?? 'Filter');

  const filter2Active = !!filter2 && filter2.value != null;
  const filter2Label = filter2Active
    ? (filter2.options.find((o) => o.value === filter2.value)?.label ?? filter2.label ?? 'Filter')
    : (filter2?.label ?? 'Filter');

  const sortActive = !!sort && sort.value != null;
  const sortLabel = sortActive
    ? (sort.options.find((o) => o.value === sort.value)?.label ?? 'Sort')
    : 'Sort';

  return (
    <View style={styles.row}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={onSearchChange}
        />
      </View>

      {filter && (
        <TouchableOpacity
          style={[styles.chip, filterActive && styles.chipActive]}
          onPress={() => setOpenPicker('filter')}
        >
          <Ionicons name="filter" size={14} color={filterActive ? colors.white : colors.maroon} />
          <Text style={[styles.chipText, filterActive && styles.chipTextActive]} numberOfLines={1}>
            {filterLabel}
          </Text>
        </TouchableOpacity>
      )}

      {filter2 && (
        <TouchableOpacity
          style={[styles.chip, filter2Active && styles.chipActive]}
          onPress={() => setOpenPicker('filter2')}
        >
          <Ionicons name="layers" size={14} color={filter2Active ? colors.white : colors.maroon} />
          <Text style={[styles.chipText, filter2Active && styles.chipTextActive]} numberOfLines={1}>
            {filter2Label}
          </Text>
        </TouchableOpacity>
      )}

      {sort && (
        <TouchableOpacity
          style={[styles.chip, sortActive && styles.chipActive]}
          onPress={() => setOpenPicker('sort')}
        >
          <Ionicons name="swap-vertical" size={14} color={sortActive ? colors.white : colors.maroon} />
          <Text style={[styles.chipText, sortActive && styles.chipTextActive]} numberOfLines={1}>
            {sortLabel}
          </Text>
        </TouchableOpacity>
      )}

      {filter && (
        <PickerModal
          visible={openPicker === 'filter'}
          title={filter.title || 'Filter'}
          options={filter.options}
          onClose={() => setOpenPicker(null)}
          onSelect={(item) => { filter.onChange(item.value); setOpenPicker(null); }}
        />
      )}
      {filter2 && (
        <PickerModal
          visible={openPicker === 'filter2'}
          title={filter2.title || 'Filter'}
          options={filter2.options}
          onClose={() => setOpenPicker(null)}
          onSelect={(item) => { filter2.onChange(item.value); setOpenPicker(null); }}
        />
      )}
      {sort && (
        <PickerModal
          visible={openPicker === 'sort'}
          title={sort.title || 'Sort by'}
          options={sort.options}
          onClose={() => setOpenPicker(null)}
          onSelect={(item) => { sort.onChange(item.value); setOpenPicker(null); }}
        />
      )}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    backgroundColor: colors.surface, padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, marginBottom: 14,
  },
  searchBox: {
    flex: 1, minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.bg, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text, padding: 0 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 11,
    borderRadius: 20, backgroundColor: colors.pink, borderWidth: 1, borderColor: colors.maroon,
    maxWidth: 130,
  },
  chipActive: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  chipText: { color: colors.maroon, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: colors.white },
});

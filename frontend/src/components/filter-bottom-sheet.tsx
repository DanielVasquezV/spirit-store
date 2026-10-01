import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { CATEGORY_OPTIONS, FUEL_OPTIONS, PRICE_BUCKETS, TRANSMISSION_OPTIONS } from '@/lib/taxonomy';
import type { Filters } from '@/lib/search';

type Option<T extends string> = { value: T; label: string };

// "Todos" se antepone a cada grupo: el backend no tiene ese valor, significa omitir el filtro.
const PRICE_OPTIONS: Option<Filters['price']>[] = PRICE_BUCKETS.map((bucket) => ({ value: bucket.id, label: bucket.label }));
const CATEGORY_CHOICES: Option<Filters['category']>[] = [{ value: 'all', label: 'Todo' }, ...CATEGORY_OPTIONS];
const TRANSMISSION_CHOICES: Option<Filters['transmission']>[] = [{ value: 'all', label: 'Todas' }, ...TRANSMISSION_OPTIONS];
const FUEL_CHOICES: Option<Filters['fuel']>[] = [{ value: 'all', label: 'Todos' }, ...FUEL_OPTIONS];

type FilterBottomSheetProps = {
  visible: boolean;
  filters: Filters;
  isActive: boolean;
  onChange: (update: Partial<Filters>) => void;
  onReset: () => void;
  onClose: () => void;
};

function ChipRow<T extends string>({ options, selected, onSelect }: { options: Option<T>[]; selected: T; onSelect: (value: T) => void }) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Chip key={option.value} label={option.label} selected={selected === option.value} onPress={() => onSelect(option.value)} />
      ))}
    </View>
  );
}

export function FilterBottomSheet({ visible, filters, isActive, onChange, onReset, onClose }: FilterBottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      {/* Capa oscura de foco: cualquier toque fuera de la hoja la cierra. */}
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <View style={styles.grabber} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>Filtros</Text>
          {isActive ? (
            <Button label="Limpiar" variant="ghost" size="sm" onPress={onReset} />
          ) : (
            <View />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Rango de precio</Text>
            <ChipRow options={PRICE_OPTIONS} selected={filters.price} onSelect={(price) => onChange({ price })} />
          </View>

          <View style={styles.group}>
            <Text style={styles.groupTitle}>Categoría</Text>
            <ChipRow options={CATEGORY_CHOICES} selected={filters.category} onSelect={(category) => onChange({ category })} />
          </View>

          <View style={styles.group}>
            <Text style={styles.groupTitle}>Transmisión</Text>
            <ChipRow options={TRANSMISSION_CHOICES} selected={filters.transmission} onSelect={(transmission) => onChange({ transmission })} />
          </View>

          <View style={styles.group}>
            <Text style={styles.groupTitle}>Combustible</Text>
            <ChipRow options={FUEL_CHOICES} selected={filters.fuel} onSelect={(fuel) => onChange({ fuel })} />
          </View>
        </ScrollView>

        <Button label="Ver resultados" fullWidth size="lg" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: Hairline,
    borderColor: Colors.border,
    paddingHorizontal: Layout.screenX,
    paddingTop: Spacing.sm,
    maxHeight: '86%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.overlayPressed,
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  title: { ...Type.h1, color: Colors.text },
  content: { paddingBottom: Spacing.lg, gap: Spacing.xl },
  group: { gap: Spacing.sm },
  groupTitle: { ...Type.label, color: Colors.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
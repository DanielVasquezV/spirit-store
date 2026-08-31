import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { CATEGORIES, FUEL_OPTIONS } from '@/lib/mock-data';

export type Filters = { price: string; category: string; transmission: string; fuel: string };

export const DEFAULT_FILTERS: Filters = {
  price: 'all',
  category: 'all',
  transmission: 'all',
  fuel: 'Todos',
};

const PRICE_BUCKETS: { id: string; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'lt25', label: 'Menos de $25,000' },
  { id: '25-50', label: '$25,000 – $50,000' },
  { id: '50-100', label: '$50,000 – $100,000' },
  { id: 'gt100', label: 'Más de $100,000' },
];

const TRANSMISSIONS = ['Todas', 'Automática', 'Manual'];

type FilterBottomSheetProps = {
  visible: boolean;
  filters: Filters;
  isActive: boolean;
  onChange: (update: Partial<Filters>) => void;
  onReset: () => void;
  onClose: () => void;
};

function ChipRow({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Chip key={option} label={option} selected={selected === option} onPress={() => onSelect(option)} />
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
            <ChipRow
              options={PRICE_BUCKETS.map((b) => b.label)}
              selected={PRICE_BUCKETS.find((b) => b.id === filters.price)?.label ?? 'Todos'}
              onSelect={(label) => {
                const bucket = PRICE_BUCKETS.find((b) => b.label === label);
                if (bucket) onChange({ price: bucket.id });
              }}
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.groupTitle}>Categoría</Text>
            <ChipRow
              options={CATEGORIES.map((c) => c.label)}
              selected={CATEGORIES.find((c) => c.id === filters.category)?.label ?? 'Todo'}
              onSelect={(label) => {
                const category = CATEGORIES.find((c) => c.label === label);
                if (category) onChange({ category: category.id });
              }}
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.groupTitle}>Transmisión</Text>
            <ChipRow options={TRANSMISSIONS} selected={filters.transmission} onSelect={(value) => onChange({ transmission: value })} />
          </View>

          <View style={styles.group}>
            <Text style={styles.groupTitle}>Combustible</Text>
            <ChipRow options={[...FUEL_OPTIONS]} selected={filters.fuel} onSelect={(value) => onChange({ fuel: value })} />
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
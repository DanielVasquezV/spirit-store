import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/components/ui/chip';
import { Colors, Spacing, Type } from '@/constants/theme';

export type ChipOption<T extends string> = { value: T; label: string };

type ChipGroupProps<T extends string> = {
  label: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

// Selección única con chips y su etiqueta, para formularios.
export function ChipGroup<T extends string>({ label, options, value, onChange }: ChipGroupProps<T>) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => (
          <Chip key={option.value} label={option.label} selected={value === option.value} onPress={() => onChange(option.value)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.sm },
  label: { ...Type.label, color: Colors.textMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});

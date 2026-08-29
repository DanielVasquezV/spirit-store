import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type ChipProps = {
  label: string;
  icon?: ReactNode;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, icon, selected = false, onPress }: ChipProps) {
  // Sin onPress no hay interacción: se renderiza como View estático (spec de chip).
  const Container = onPress ? Pressable : View;

  return (
    <Container
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}>
      {icon}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    height: 28,
    paddingHorizontal: Spacing.md - 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.overlay,
  },
  chipSelected: { backgroundColor: Colors.accent },
  chipPressed: { backgroundColor: Colors.overlayPressed },
  label: { ...Type.caption, color: Colors.textSecondary },
  labelSelected: { color: Colors.textInverse },
});
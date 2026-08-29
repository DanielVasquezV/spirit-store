import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { Colors, Layout, Motion, Radius, Spacing, Type } from '@/constants/theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      {/* Slots laterales de ancho fijo: el título queda centrado aunque falte back o right */}
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [styles.slot, pressed && styles.pressed]}>
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </Pressable>
      ) : (
        <View style={styles.slot} />
      )}

      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {right ?? <View style={styles.slot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.screenX,
    minHeight: Layout.headerHeight,
    gap: Spacing.sm,
  },
  slot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  pressed: { opacity: Motion.pressOpacity },
  center: { flex: 1, alignItems: 'center' },
  title: { ...Type.h1, color: Colors.text },
  subtitle: { ...Type.caption, color: Colors.textMuted },
});
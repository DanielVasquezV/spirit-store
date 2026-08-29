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
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Feather name="arrow-left" size={24} color={Colors.text} />
          </Pressable>
        ) : null}
      </View>

      {/* Centrado respecto al ancho completo del header, no al espacio entre laterales */}
      <View pointerEvents="none" style={styles.center}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.side}>{right}</View>
    </View>
  );
}

const SIDE_WIDTH = Layout.touchMin;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenX,
    minHeight: Layout.headerHeight,
  },
  side: {
    width: SIDE_WIDTH,
    minHeight: SIDE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  action: {
    width: SIDE_WIDTH,
    height: SIDE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  pressed: { opacity: Motion.pressOpacity },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIDE_WIDTH + Spacing.sm,
  },
  title: { ...Type.h1, color: Colors.text, textAlign: 'center' },
  subtitle: { ...Type.caption, color: Colors.textMuted, textAlign: 'center' },
});
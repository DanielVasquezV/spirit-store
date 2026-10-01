import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Layout, Motion, Radius, Spacing, Type } from '@/constants/theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    // El safe area vive acá: si cada pantalla lo suma por su cuenta, ficha y subasta quedan bajo la barra de estado.
    <View style={[styles.bar, { paddingTop: insets.top }]}>
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
        </View>

        <View style={styles.side}>{right}</View>
      </View>

      {/* Fuera de la fila: en el mismo bloque centrado el título sube y deja de coincidir con el volver. */}
      {subtitle ? (
        <Text numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const SIDE_WIDTH = Layout.touchMin;

const styles = StyleSheet.create({
  bar: { backgroundColor: Colors.bg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.screenX,
    height: Layout.headerHeight,
  },
  side: {
    width: SIDE_WIDTH,
    height: SIDE_WIDTH,
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
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIDE_WIDTH + Spacing.sm,
  },
  title: { ...Type.h1, color: Colors.text, textAlign: 'center' },
  subtitle: {
    ...Type.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: -Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Layout.screenX + SIDE_WIDTH,
  },
});

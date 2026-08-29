import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';

type FeatherName = ComponentProps<typeof Feather>['name'];

type IconButtonProps = {
  icon: FeatherName;
  accessibilityLabel: string;
  size?: number;
  iconSize?: number;
  color?: string;
  badge?: number;
  onPress?: () => void;
  disabled?: boolean;
};

export function IconButton({
  icon,
  accessibilityLabel,
  size = 44,
  iconSize = 20,
  color = Colors.text,
  badge,
  onPress,
  disabled = false,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, borderRadius: Radius.sm },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Feather name={icon} size={iconSize} color={color} />
      {/* Más de 9 se condensa a "9+" para que el badge no deforme el botón */}
      {typeof badge === 'number' && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: Colors.overlayPressed },
  disabled: { opacity: 0.4 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: FontFamily.semibold,
    color: Colors.textInverse,
  },
});
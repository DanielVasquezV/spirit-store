import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { Colors, Motion, Radius, Spacing, Type } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 48, lg: 56 };

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHT[size] },
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && styles[`${variant}Pressed`],
        disabled && styles.disabled,
      ]}
      {...rest}>
      <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.sm,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.4 },
  label: Type.label,

  primary: { backgroundColor: Colors.accent },
  primaryPressed: { backgroundColor: Colors.accentPressed },
  primaryLabel: { color: Colors.textInverse },

  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.borderStrong },
  secondaryPressed: { backgroundColor: Colors.overlay },
  secondaryLabel: { color: Colors.text },

  ghost: { backgroundColor: 'transparent', paddingHorizontal: Spacing.sm },
  ghostPressed: { opacity: Motion.pressOpacity },
  ghostLabel: { color: Colors.textMuted },

  danger: { backgroundColor: Colors.danger },
  dangerPressed: { opacity: 0.85 },
  dangerLabel: { color: '#FFFFFF' },
});
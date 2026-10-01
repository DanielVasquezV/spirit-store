import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { Colors, Hairline, Layout, Spacing } from '@/constants/theme';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';

export function StickyCta({ children }: { children: ReactNode }) {
  const { keyboardHeight, barPaddingBottom } = useKeyboardInset();

  return <View style={[styles.bar, { bottom: keyboardHeight, paddingBottom: barPaddingBottom }]}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Layout.screenX,
    paddingTop: Spacing.md,
    backgroundColor: Colors.bg,
    borderTopWidth: Hairline,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
});
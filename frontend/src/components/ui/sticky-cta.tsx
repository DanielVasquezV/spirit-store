import { StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Hairline, Layout, Spacing } from '@/constants/theme';

export function StickyCta({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return <View style={[styles.bar, { paddingBottom: insets.bottom || Spacing.lg }]}>{children}</View>;
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
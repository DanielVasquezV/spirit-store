import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type BadgeProps = { label: string; tone?: 'neutral' | 'accent' };

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return (
    <View style={[styles.badge, tone === 'accent' && styles.badgeAccent]}>
      <Text style={[styles.text, tone === 'accent' && styles.textAccent]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xs,
    backgroundColor: Colors.overlay,
  },
  badgeAccent: { backgroundColor: Colors.accent },
  text: { ...Type.labelSm, color: Colors.textSecondary },
  textAccent: { color: Colors.textInverse },
});
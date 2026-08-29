import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { Colors, Spacing, Type } from '@/constants/theme';

type SectionHeaderProps = { title: string; count?: string; action?: ReactNode };

export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {count ? <Text style={styles.count}>{count}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  left: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  title: { ...Type.h1, color: Colors.text },
  count: { ...Type.labelSm, color: Colors.textMuted },
});
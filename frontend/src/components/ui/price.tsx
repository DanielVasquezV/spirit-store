import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Type } from '@/constants/theme';

type PriceProps = { amount: number; currency?: string; caption?: string };

export function Price({ amount, currency = '$', caption }: PriceProps) {
  // Entero y decimales en partes separadas para estilizarlos de forma independiente.
  const [whole, cents = '00'] = amount.toFixed(2).split('.');

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.whole}>{whole}</Text>
        <Text style={styles.cents}>
          .{cents} {currency}
        </Text>
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  whole: { ...Type.price, color: Colors.text },
  cents: { ...Type.priceCents, color: Colors.text, marginBottom: 2 },
  caption: { ...Type.labelSm, color: Colors.textMuted },
});
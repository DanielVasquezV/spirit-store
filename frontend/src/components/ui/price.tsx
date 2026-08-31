import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Type } from '@/constants/theme';
import { formatPriceParts } from '@/lib/format';

type PriceProps = { amount: number; currency?: string; caption?: string; variant?: 'default' | 'hero' };

export function Price({ amount, currency = '$', caption, variant = 'default' }: PriceProps) {
  const { whole, cents } = formatPriceParts(amount);
  const wholeStyle = variant === 'hero' ? styles.wholeHero : styles.whole;
  const centsStyle = variant === 'hero' ? styles.centsHero : styles.cents;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={wholeStyle}>{whole}</Text>
        <Text style={centsStyle}>
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
  wholeHero: { ...Type.priceHero, color: Colors.text },
  centsHero: { ...Type.priceCentsHero, color: Colors.text, marginBottom: 2 },
  caption: { ...Type.labelSm, color: Colors.textMuted },
});
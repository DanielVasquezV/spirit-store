import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Price } from '@/components/ui/price';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StickyCta } from '@/components/ui/sticky-cta';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { formatPriceParts } from '@/lib/format';
import { CART_ITEMS, type CartItem } from '@/lib/mock-data';

const TAX_RATE = 0.13;

export default function CartScreen() {
  const [items, setItems] = useState<CartItem[]>(CART_ITEMS);

  const subtotal = items.reduce((total, item) => total + item.price, 0);
  const taxes = subtotal * TAX_RATE;
  const total = subtotal + taxes;

  const removeItem = (id: string) => setItems((current) => current.filter((item) => item.id !== id));

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScreenHeader title="Carrito" onBack={() => router.back()} />
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="shopping-bag" size={44} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
          <Text style={styles.emptyBody}>Los vehículos que guardes aparecerán acá listos para cerrar la compra.</Text>
          <Button label="Explorar Vehículos" variant="secondary" fullWidth onPress={() => router.push('/search')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title={`Carrito · ${items.length}`} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Layout.ctaBarHeight + Spacing.lg }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.items}>
          {items.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.itemIcon}>
                <Feather name="truck" size={24} color={Colors.borderStrong} />
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.itemMeta}>{item.year}</Text>
              </View>
              <View style={styles.itemRight}>
                <Price amount={item.price} />
                <IconButton
                  icon="trash-2"
                  accessibilityLabel={`Quitar ${item.title}`}
                  size={40}
                  onPress={() => removeItem(item.id)}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>Resumen</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Subtotal</Text>
            <Text style={styles.breakdownValue}>${formatPriceParts(subtotal).whole}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Impuestos (13%)</Text>
            <Text style={styles.breakdownValue}>${formatPriceParts(taxes).whole}</Text>
          </View>
          <View style={styles.dividerThrough} />
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownTotal}>Total</Text>
            <Text style={styles.breakdownTotalValue}>${formatPriceParts(total).whole}</Text>
          </View>
        </View>
      </ScrollView>

      <StickyCta>
        <Button label="Proceder al Pago" fullWidth size="lg" onPress={() => {}} />
      </StickyCta>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xxl },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: Radius.lg,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: { ...Type.h2, color: Colors.text, textAlign: 'center' },
  emptyBody: { ...Type.body, color: Colors.textSecondary, textAlign: 'center' },
  items: { gap: Layout.gap },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  itemIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.xs,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, gap: Spacing.xs },
  itemTitle: { ...Type.bodyStrong, color: Colors.text },
  itemMeta: { ...Type.caption, color: Colors.textMuted },
  itemRight: { alignItems: 'flex-end', gap: Spacing.xs },
  breakdown: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  breakdownTitle: { ...Type.label, color: Colors.textSecondary, marginBottom: Spacing.xs },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breakdownLabel: { ...Type.body, color: Colors.textSecondary },
  breakdownValue: { ...Type.body, color: Colors.text },
  breakdownTotal: { ...Type.bodyStrong, color: Colors.text },
  breakdownTotalValue: { ...Type.price, color: Colors.text },
  dividerThrough: { height: Hairline, backgroundColor: Colors.border, marginVertical: Spacing.xs },
});
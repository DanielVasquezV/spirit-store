import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StateView } from '@/components/state-view';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { purchaseHref } from '@/features/orders/order-rules';
import { usePurchaseList } from '@/features/orders/use-orders';
import { formatBidStamp, formatPriceParts } from '@/lib/format';
import { ORDER_STATUS_LABELS } from '@/lib/taxonomy';
import type { OrderDto } from '@/lib/types/api';

const ROLES = [
  { value: 'buyer' as const, label: 'Mis compras' },
  { value: 'seller' as const, label: 'Mis ventas' },
];

export default function PurchasesScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const [role, setRole] = useState<'buyer' | 'seller'>(params.role === 'seller' ? 'seller' : 'buyer');
  const { orders, items } = usePurchaseList(role);

  const renderItem = ({ item }: { item: OrderDto }) => {
    const pending = item.status === 'PENDING_PAYMENT';
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(purchaseHref(item, role))}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.thumb}>
          {item.vehicle.imageUrl ? (
            <Image source={{ uri: item.vehicle.imageUrl }} style={styles.image} contentFit="cover" />
          ) : (
            <Feather name="truck" size={22} color={Colors.borderStrong} />
          )}
        </View>
        <View style={styles.info}>
          <View style={styles.top}>
            <Text style={styles.title} numberOfLines={1}>{item.vehicle.title}</Text>
            <Badge label={ORDER_STATUS_LABELS[item.status]} tone={item.status === 'PAID' ? 'accent' : 'neutral'} />
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {item.origin === 'AUCTION' ? 'Subasta ganada' : 'Compra directa'} · {formatBidStamp(new Date(item.createdAt))} · {role === 'buyer' ? item.seller.fullName : item.buyer.fullName}
          </Text>
          <View style={styles.bottom}>
            <Text style={styles.total}>${formatPriceParts(item.totalAmount).whole}</Text>
            {pending && role === 'buyer' ? <Text style={styles.cta}>Pagar ahora</Text> : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader title="Compras" onBack={() => router.back()} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsBar}>
        {ROLES.map((item) => (
          <Chip key={item.value} label={item.label} selected={role === item.value} onPress={() => setRole(item.value)} />
        ))}
      </ScrollView>
      <FlatList
        data={items}
        keyExtractor={(order) => order.id}
        renderItem={renderItem}
        ListEmptyComponent={
          orders.isPending ? null : orders.isError ? (
            <StateView icon="wifi-off" title="No pudimos cargar tus compras" actionLabel="Reintentar" onAction={() => void orders.refetch()} />
          ) : role === 'buyer' ? (
            <StateView icon="shopping-bag" title="Todavía no compraste" body="Cuando compres un vehículo o ganes una subasta, aparece acá." actionLabel="Explorar vehículos" onAction={() => router.push('/search')} />
          ) : (
            <StateView icon="tag" title="Sin ventas" body="Las compras de tus vehículos publicados aparecen acá." />
          )
        }
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor={Colors.textMuted} />}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  chipsBar: { flexGrow: 0 },
  chips: { gap: Spacing.sm, paddingHorizontal: Layout.screenX, paddingTop: Spacing.md },
  content: { padding: Layout.screenX },
  separator: { height: Spacing.sm },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  pressed: { backgroundColor: Colors.overlay },
  thumb: { width: 64, height: 64, borderRadius: Radius.xs, backgroundColor: Colors.overlay, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  info: { flex: 1, gap: Spacing.xs },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  title: { flex: 1, ...Type.bodyStrong, color: Colors.text },
  meta: { ...Type.caption, color: Colors.textMuted },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { ...Type.h3, color: Colors.text },
  cta: { ...Type.label, color: Colors.warning },
});

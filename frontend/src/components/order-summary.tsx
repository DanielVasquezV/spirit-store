import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Colors, Hairline, Radius, Spacing, Type } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import { ORDER_STATUS_LABELS } from '@/lib/taxonomy';
import type { OrderDto } from '@/lib/types/api';

// Vehículo + desglose calculado por el servidor; lo comparten checkout y comprobante.
export function OrderSummary({ order, showStatus = false }: { order: OrderDto; showStatus?: boolean }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.vehicle}>
        <View style={styles.thumb}>
          {order.vehicle.imageUrl ? (
            <Image source={{ uri: order.vehicle.imageUrl }} style={styles.image} contentFit="cover" />
          ) : (
            <Feather name="truck" size={24} color={Colors.borderStrong} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{order.vehicle.title}</Text>
          <Text style={styles.meta}>{order.vehicle.year} · {order.orderNumber}</Text>
          <View style={styles.badges}>
            <Badge label={order.origin === 'AUCTION' ? 'Subasta ganada' : 'Compra directa'} />
            {showStatus ? <Badge label={ORDER_STATUS_LABELS[order.status]} tone={order.status === 'PAID' ? 'accent' : 'neutral'} /> : null}
          </View>
        </View>
      </View>

      <View style={styles.breakdown}>
        <View style={styles.row}>
          <Text style={styles.label}>{order.origin === 'AUCTION' ? 'Puja ganadora' : 'Precio del vehículo'}</Text>
          <Text style={styles.value}>{formatMoney(order.subtotal, { cents: true })}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>IVA ({Math.round(order.taxRate * 100)}%)</Text>
          <Text style={styles.value}>{formatMoney(order.taxAmount, { cents: true })}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.total}>Total</Text>
          <Text style={styles.totalValue}>{formatMoney(order.totalAmount, { cents: true })} {order.currency}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  vehicle: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  thumb: { width: 72, height: 72, borderRadius: Radius.xs, backgroundColor: Colors.overlay, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  info: { flex: 1, gap: Spacing.xs, justifyContent: 'center' },
  title: { ...Type.bodyStrong, color: Colors.text },
  meta: { ...Type.caption, color: Colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs + 2 },
  breakdown: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...Type.body, color: Colors.textSecondary },
  value: { ...Type.body, color: Colors.text },
  divider: { height: Hairline, backgroundColor: Colors.border, marginVertical: Spacing.xs },
  total: { ...Type.bodyStrong, color: Colors.text },
  totalValue: { ...Type.h3, color: Colors.text },
});

import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { OrderSummary } from '@/components/order-summary';
import { DetailSkeleton } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StickyCta } from '@/components/ui/sticky-cta';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { usePurchaseDetail } from '@/features/orders/use-orders';
import { messageFor } from '@/lib/api/api-error';
import { formatClock } from '@/lib/format';
import { ORDER_STATUS_LABELS } from '@/lib/taxonomy';

const STATUS_ICON = { PAID: 'check-circle', PENDING_PAYMENT: 'clock', CANCELLED: 'x-circle', FAILED: 'x-circle', REFUNDED: 'rotate-ccw' } as const;

export default function PurchaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const purchase = usePurchaseDetail(id);
  const { order, isBuyer, pending, paid, remaining } = purchase;

  if (purchase.query.isPending) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detalle de compra" onBack={() => router.back()} />
        <DetailSkeleton />
      </View>
    );
  }
  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.missing}>No encontramos esta compra</Text>
        <Button label="Volver" size="sm" onPress={() => router.back()} />
      </View>
    );
  }

  const tone = paid ? Colors.success : pending ? Colors.warning : Colors.danger;
  const contact = () => void purchase.contact().then((chat) => chat && router.push(`/chat/${chat.id}`));

  return (
    <View style={styles.screen}>
      <ScreenHeader title={isBuyer ? 'Detalle de compra' : 'Detalle de venta'} subtitle={order.orderNumber} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.status}>
          <Feather name={STATUS_ICON[order.status]} size={40} color={tone} />
          <Text style={styles.statusTitle}>{paid && isBuyer ? '¡Compra pagada!' : ORDER_STATUS_LABELS[order.status]}</Text>
          {pending ? (
            <Text style={styles.statusBody}>
              {isBuyer
                ? remaining > 0
                  ? `Pagá antes de ${formatClock(Math.floor(remaining / 1000))} para quedarte con el vehículo.`
                  : 'La reserva venció.'
                : 'El comprador todavía no pagó.'}
            </Text>
          ) : null}
          {paid ? <Text style={styles.statusBody}>Coordiná la entrega con {isBuyer ? 'el vendedor' : 'el comprador'} por el chat.</Text> : null}
        </View>

        <OrderSummary order={order} />

        <View style={styles.details}>
          {purchase.rows.map((item) => (
            <View key={item.label} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{item.label}</Text>
              <Text style={styles.detailValue}>{item.value}</Text>
            </View>
          ))}
        </View>
        {purchase.contactError ? <Text style={styles.error}>{messageFor(purchase.contactError, 'No pudimos abrir el chat.')}</Text> : null}
      </ScrollView>

      <StickyCta>
        {pending && isBuyer && remaining > 0 ? (
          <Button label="Completar pago" fullWidth size="lg" onPress={() => router.push(`/checkout/${order.id}`)} />
        ) : null}
        {paid ? (
          <Button
            label={purchase.contacting ? 'Abriendo chat…' : isBuyer ? 'Contactar al vendedor' : 'Ver mensajes del comprador'}
            fullWidth
            size="lg"
            disabled={purchase.contacting}
            onPress={isBuyer ? contact : () => router.push('/chats')}
          />
        ) : null}
        <Button label="Ver vehículo" variant="ghost" fullWidth onPress={() => router.push(`/product/${order.vehicleId}`)} />
      </StickyCta>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, backgroundColor: Colors.bg },
  missing: { ...Type.h2, color: Colors.text },
  content: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.md, paddingBottom: Layout.ctaBarHeight * 2 + Spacing.lg, gap: Spacing.lg },
  status: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  statusTitle: { ...Type.h2, color: Colors.text, textAlign: 'center' },
  statusBody: { ...Type.body, color: Colors.textSecondary, textAlign: 'center' },
  details: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  detailLabel: { ...Type.bodySm, color: Colors.textMuted },
  detailValue: { ...Type.bodySm, color: Colors.text, flexShrink: 1, textAlign: 'right' },
  error: { ...Type.caption, color: Colors.danger },
});

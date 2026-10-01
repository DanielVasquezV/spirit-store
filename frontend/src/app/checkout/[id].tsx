import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OrderSummary } from '@/components/order-summary';
import { DetailSkeleton } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StickyCta } from '@/components/ui/sticky-cta';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { useCheckoutForm } from '@/features/orders/use-checkout-form';
import { messageFor } from '@/lib/api/api-error';
import { formatClock, formatPriceParts } from '@/lib/format';
import { BRAND_LABELS, digitsOnly, TEST_CARDS } from '@/lib/payment';
import type { PaymentMethod } from '@/lib/types/api';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'BANK_TRANSFER', label: 'Transferencia' },
];

// Datos ficticios: el pago es simulado y nadie transfiere dinero real.
const BANK_DETAILS = [
  { label: 'Banco', value: 'Banco Spirit (simulado)' },
  { label: 'Cuenta corriente', value: '000-123456-7' },
  { label: 'A nombre de', value: 'Spirit Apex S.A. de C.V.' },
];

export default function CheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const checkout = useCheckoutForm(id);
  const { order, orderQuery, remaining, expired, method, card, errors } = checkout;

  if (orderQuery.isPending) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Pagar compra" onBack={() => router.back()} />
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

  // Ya pagada o cancelada: el checkout no aplica y se muestra el comprobante.
  if (order.status !== 'PENDING_PAYMENT') return <Redirect href={`/purchase/${order.id}`} />;

  const busy = checkout.paying || checkout.cancelling;
  const submit = () => void checkout.submit().then((paid) => paid && router.replace(`/purchase/${order.id}`));
  const cancel = () => void checkout.cancelOrder().then((done) => done && router.replace(`/purchase/${order.id}`));

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Pagar compra" subtitle={order.orderNumber} onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          <View style={styles.timer}>
            <Text style={[styles.timerText, expired && styles.timerTextExpired]}>
              {expired ? 'La reserva venció: el vehículo volvió al catálogo.' : `Reservado a tu nombre · vence en ${formatClock(Math.floor(remaining / 1000))}`}
            </Text>
          </View>

          <OrderSummary order={order} />

          {order.paymentStatus === 'FAILED' && !checkout.declinedNow ? (
            <Text style={styles.warning}>Tu último intento fue rechazado{order.paymentReference ? ` (${order.paymentReference})` : ''}. Probá con otro medio.</Text>
          ) : null}

          <Text style={styles.section}>Medio de pago</Text>
          <View style={styles.chips}>
            {METHODS.map((item) => (
              <Chip key={item.value} label={item.label} selected={method === item.value} onPress={() => checkout.setMethod(item.value)} />
            ))}
          </View>

          {method === 'CARD' ? (
            <View style={styles.form}>
              <Field label="Nombre del titular" value={card.holderName} onChangeText={checkout.setCardField('holderName')} error={errors.holderName} autoCapitalize="words" placeholder="Como aparece en la tarjeta" />
              <Field
                label="Número de tarjeta"
                value={card.number}
                onChangeText={checkout.setCardField('number')}
                error={errors.number}
                helper={digitsOnly(card.number).length >= 2 ? BRAND_LABELS[checkout.brand] : undefined}
                keyboardType="number-pad"
                placeholder="0000 0000 0000 0000"
                autoComplete="off"
              />
              <View style={styles.row}>
                <View style={styles.cell}>
                  <Field label="Vencimiento" value={card.expiry} onChangeText={checkout.setCardField('expiry')} error={errors.expiry} keyboardType="number-pad" placeholder="MM/AA" />
                </View>
                <View style={styles.cell}>
                  <Field label="CVV" value={card.cvv} onChangeText={checkout.setCardField('cvv')} error={errors.cvv} keyboardType="number-pad" placeholder="123" secureTextEntry />
                </View>
              </View>
              <Text style={styles.hint}>
                Pago simulado: usá {TEST_CARDS.approved} para aprobar o {TEST_CARDS.declined} para probar un rechazo. Ningún dato sale del teléfono salvo los últimos 4 dígitos.
              </Text>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.bank}>
                {BANK_DETAILS.map((item) => (
                  <View key={item.label} style={styles.bankRow}>
                    <Text style={styles.bankLabel}>{item.label}</Text>
                    <Text style={styles.bankValue}>{item.value}</Text>
                  </View>
                ))}
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Monto</Text>
                  <Text style={styles.bankValue}>${formatPriceParts(order.totalAmount).whole}.{formatPriceParts(order.totalAmount).cents} {order.currency}</Text>
                </View>
              </View>
              <Field
                label="Referencia de la transferencia"
                value={checkout.reference}
                onChangeText={checkout.setReference}
                error={errors.transferReference}
                autoCapitalize="characters"
                placeholder="Ej. BAC-778812"
              />
              <Text style={styles.hint}>Pago simulado: la transferencia se acredita en el acto con cualquier referencia válida.</Text>
            </View>
          )}

          {checkout.payError ? <Text style={styles.error}>{messageFor(checkout.payError, 'No pudimos procesar el pago.')}</Text> : null}
          {checkout.cancelError ? <Text style={styles.error}>{messageFor(checkout.cancelError, 'No pudimos cancelar la compra.')}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <StickyCta>
        <Button
          label={checkout.paying ? 'Procesando pago…' : `Pagar $${formatPriceParts(order.totalAmount).whole}`}
          fullWidth
          size="lg"
          disabled={busy || expired}
          onPress={submit}
        />
        <Button
          label={checkout.cancelling ? 'Cancelando…' : 'Cancelar compra'}
          variant="ghost"
          fullWidth
          disabled={busy}
          onPress={cancel}
        />
      </StickyCta>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, backgroundColor: Colors.bg },
  missing: { ...Type.h2, color: Colors.text },
  content: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.md, paddingBottom: Layout.ctaBarHeight * 2 + Spacing.lg, gap: Spacing.lg },
  timer: { padding: Spacing.md, borderRadius: Radius.sm, backgroundColor: Colors.overlay },
  timerText: { ...Type.label, color: Colors.textSecondary },
  timerTextExpired: { color: Colors.danger },
  section: { ...Type.label, color: Colors.textMuted },
  chips: { flexDirection: 'row', gap: Spacing.sm },
  form: { gap: Spacing.lg },
  row: { flexDirection: 'row', gap: Spacing.md },
  cell: { flex: 1 },
  hint: { ...Type.caption, color: Colors.textMuted },
  warning: { ...Type.caption, color: Colors.warning },
  error: { ...Type.caption, color: Colors.danger },
  bank: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  bankRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  bankLabel: { ...Type.bodySm, color: Colors.textMuted },
  bankValue: { ...Type.bodySm, color: Colors.text, flexShrink: 1, textAlign: 'right' },
});

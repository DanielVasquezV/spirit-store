import { useState } from 'react';
import { useCountdown } from '@/hooks/use-countdown';
import { API_ERROR_CODES, fieldErrors, hasCode } from '@/lib/api/api-error';
import { detectBrand, digitsOnly, formatCardNumber, formatExpiry, validateCard, type CardFields } from '@/lib/payment';
import type { OrderDto, PaymentMethod } from '@/lib/types/api';
import { useCancelOrder, useOrder, usePayOrder } from './use-orders';

const TRANSFER_REFERENCE = /^[A-Za-z0-9-]{4,30}$/;

// Checkout de una orden: estado del formulario de pago, validación local, cobro simulado y cancelación.
export function useCheckoutForm(orderId: string | undefined) {
  const orderQuery = useOrder(orderId);
  const pay = usePayOrder(orderId ?? '');
  const cancel = useCancelOrder(orderId ?? '');
  const order = orderQuery.data;
  const remaining = useCountdown(order?.expiresAt);

  const [method, setMethod] = useState<PaymentMethod>('CARD');
  const [card, setCard] = useState<CardFields>({ holderName: '', number: '', expiry: '', cvv: '' });
  const [reference, setReference] = useState('');
  const [localErrors, setLocalErrors] = useState<Record<string, string | undefined>>({});

  // Número y vencimiento se formatean mientras se escriben para que se lean como en el plástico.
  const setCardField = (key: keyof CardFields) => (value: string) => {
    const formatted = key === 'number' ? formatCardNumber(value) : key === 'expiry' ? formatExpiry(value) : key === 'cvv' ? digitsOnly(value).slice(0, 4) : value;
    setCard((current) => ({ ...current, [key]: formatted }));
  };

  const brand = detectBrand(card.number);
  const server = fieldErrors(pay.error);

  // Valida en el teléfono y cobra; resuelve la orden pagada o null si no se pudo.
  const submit = (): Promise<OrderDto | null> => {
    if (method === 'CARD') {
      const found = validateCard(card);
      setLocalErrors(found);
      if (Object.keys(found).length > 0) return Promise.resolve(null);
      // Del número solo salen los últimos 4: el resto y el CVV no dejan el teléfono.
      return pay
        .mutateAsync({ paymentMethod: 'CARD', card: { brand, last4: digitsOnly(card.number).slice(-4), holderName: card.holderName.trim() } })
        .catch(() => null);
    }
    if (!TRANSFER_REFERENCE.test(reference.trim())) {
      setLocalErrors({ transferReference: 'La referencia tiene entre 4 y 30 letras o números.' });
      return Promise.resolve(null);
    }
    setLocalErrors({});
    return pay.mutateAsync({ paymentMethod: 'BANK_TRANSFER', transferReference: reference.trim() }).catch(() => null);
  };

  const cancelOrder = (): Promise<boolean> => cancel.mutateAsync().then(() => true).catch(() => false);

  return {
    orderQuery,
    order,
    remaining,
    expired: Boolean(order?.expiresAt) && remaining === 0,
    method,
    setMethod,
    card,
    setCardField,
    brand,
    reference,
    setReference,
    errors: {
      holderName: localErrors.holderName ?? server['card.holderName'],
      number: localErrors.number,
      expiry: localErrors.expiry,
      cvv: localErrors.cvv,
      transferReference: localErrors.transferReference ?? server.transferReference,
    },
    submit,
    paying: pay.isPending,
    payError: pay.error,
    // Un rechazo que ya llegó en esta sesión se muestra como error; uno previo, como aviso sobre la orden.
    declinedNow: hasCode(pay.error, API_ERROR_CODES.PAYMENT_DECLINED),
    cancelOrder,
    cancelling: cancel.isPending,
    cancelError: cancel.error,
  };
}

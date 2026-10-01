import { formatBidStamp } from '@/lib/format';
import { PAYMENT_METHOD_LABELS } from '@/lib/taxonomy';
import type { OrderDto } from '@/lib/types/api';

// Reglas puras de órdenes: orden de las listas, destinos y filas del comprobante.

// Las pendientes de pago van primero: son las únicas que piden una acción del usuario.
export function sortPurchases(orders: OrderDto[]): OrderDto[] {
  return [...orders].sort((a, b) => Number(b.status === 'PENDING_PAYMENT') - Number(a.status === 'PENDING_PAYMENT'));
}

// El comprador con una orden pendiente va directo a pagar; el resto ve el comprobante.
export function purchaseHref(order: OrderDto, role: 'buyer' | 'seller'): `/checkout/${string}` | `/purchase/${string}` {
  return order.status === 'PENDING_PAYMENT' && role === 'buyer' ? `/checkout/${order.id}` : `/purchase/${order.id}`;
}

export interface ReceiptRow {
  label: string;
  value: string;
}

// Filas del comprobante según quién lo mira: el comprador ve al vendedor y viceversa.
export function receiptRows(order: OrderDto, isBuyer: boolean): ReceiptRow[] {
  return [
    { label: isBuyer ? 'Vendedor' : 'Comprador', value: isBuyer ? order.seller.fullName : order.buyer.fullName },
    { label: 'Fecha de la orden', value: formatBidStamp(new Date(order.createdAt)) },
    order.status === 'PAID' && order.completedAt ? { label: 'Pagada el', value: formatBidStamp(new Date(order.completedAt)) } : null,
    order.paymentMethod ? { label: 'Medio de pago', value: PAYMENT_METHOD_LABELS[order.paymentMethod] } : null,
    order.paymentReference ? { label: 'Referencia', value: order.paymentReference } : null,
  ].filter((row): row is ReceiptRow => row !== null);
}

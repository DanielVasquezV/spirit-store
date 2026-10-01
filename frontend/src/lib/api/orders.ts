import { http } from './http-client';
import type { CheckoutSessionDto, OrderDto } from '@/lib/types/api';

export interface CreateOrderInput {
  vehicleId: string;
  // Precio que vio el usuario: si cambió, el backend responde 409 en vez de cobrar otra cifra.
  expectedVehiclePrice?: number;
  chatId?: string;
}

export function createOrder(input: CreateOrderInput): Promise<OrderDto> {
  return http.post<OrderDto>('/orders', input);
}

export function listMyOrders(role?: 'buyer' | 'seller'): Promise<OrderDto[]> {
  return http.get<OrderDto[]>('/orders', { query: { role } });
}

export function getOrder(id: string): Promise<OrderDto> {
  return http.get<OrderDto>(`/orders/${id}`);
}

export function createCheckoutSession(orderId: string): Promise<CheckoutSessionDto> {
  return http.post<CheckoutSessionDto>(`/orders/${orderId}/checkout-session`);
}

// Del medio de pago solo viaja lo mostrable en el comprobante: el número completo y el CVV no salen del teléfono.
export type PaymentInput =
  | { paymentMethod: 'CARD'; card: { brand: string; last4: string; holderName: string } }
  | { paymentMethod: 'BANK_TRANSFER'; transferReference: string };

export function confirmOrder(orderId: string, payment: PaymentInput): Promise<OrderDto> {
  return http.post<OrderDto>(`/orders/${orderId}/confirm`, payment);
}

export function cancelOrder(orderId: string): Promise<void> {
  return http.post<void>(`/orders/${orderId}/cancel`);
}

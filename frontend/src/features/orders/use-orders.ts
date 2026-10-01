import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsAuthenticated, useSession } from '@/features/auth/session-provider';
import { auctionKeys } from '@/features/auctions/use-auctions';
import { catalogKeys } from '@/features/catalog/use-catalog';
import { cancelOrder, confirmOrder, createCheckoutSession, createOrder, getOrder, listMyOrders, type PaymentInput } from '@/lib/api/orders';
import { useOpenChat } from '@/features/chats/use-chats';
import { useCountdown } from '@/hooks/use-countdown';
import type { ChatPreviewDto, OrderDto } from '@/lib/types/api';
import { receiptRows, sortPurchases } from './order-rules';

export const orderKeys = {
  all: ['orders'] as const,
  mine: (role?: 'buyer' | 'seller') => ['orders', 'mine', role ?? 'all'] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
};

export function useMyOrders(role?: 'buyer' | 'seller') {
  const authed = useIsAuthenticated();
  return useQuery({ queryKey: orderKeys.mine(role), queryFn: () => listMyOrders(role), enabled: authed });
}

// Compras que esperan pago: alimentan el badge del ícono de compras en Home.
export function usePendingPurchases(): OrderDto[] {
  const { status } = useSession();
  // Las fichas y subastas se pueden abrir sin sesión por deep link: ahí no hay compras que consultar.
  const purchases = useQuery({
    queryKey: orderKeys.mine('buyer'),
    queryFn: () => listMyOrders('buyer'),
    enabled: status === 'authenticated',
  });
  return (purchases.data ?? []).filter((order) => order.status === 'PENDING_PAYMENT');
}

export function useOrder(id: string | undefined) {
  const authed = useIsAuthenticated();
  return useQuery({ queryKey: orderKeys.detail(id ?? ''), queryFn: () => getOrder(id!), enabled: authed && Boolean(id) });
}

// Comprar, pagar o cancelar mueve el estado del vehículo: catálogo, subastas y compras se refrescan juntos.
function useInvalidateCommerce() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    void queryClient.invalidateQueries({ queryKey: auctionKeys.active });
  };
}

// Reserva el vehículo creando la orden; el IVA y el total los calcula el servidor.
export function useBuyNow() {
  const invalidate = useInvalidateCommerce();
  return useMutation({
    mutationFn: ({ vehicleId, price }: { vehicleId: string; price: number }) => createOrder({ vehicleId, expectedVehiclePrice: price }),
    onSuccess: invalidate,
  });
}

// Abre la sesión simulada y confirma: es el par que en una pasarela real sería PaymentIntent + confirmación.
export function usePayOrder(orderId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCommerce();
  return useMutation({
    mutationFn: async (payment: PaymentInput) => {
      await createCheckoutSession(orderId);
      return confirmOrder(orderId, payment);
    },
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(orderId), order);
      invalidate();
    },
    // Un rechazo deja la orden con paymentStatus FAILED: se relee para mostrar el intento fallido.
    onError: () => void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) }),
  });
}

export function useCancelOrder(orderId: string) {
  const invalidate = useInvalidateCommerce();
  return useMutation({ mutationFn: () => cancelOrder(orderId), onSuccess: invalidate });
}

// Compras o ventas del usuario, con las pendientes de pago primero.
export function usePurchaseList(role: 'buyer' | 'seller') {
  const orders = useMyOrders(role);
  return { orders, items: sortPurchases(orders.data ?? []) };
}

// Comprobante: la orden, desde qué lado se mira, la cuenta regresiva si falta pagar y el contacto con la otra parte.
export function usePurchaseDetail(orderId: string | undefined) {
  const { user } = useSession();
  const query = useOrder(orderId);
  const openChat = useOpenChat();
  const order = query.data;
  const remaining = useCountdown(order?.status === 'PENDING_PAYMENT' ? order.expiresAt : null);
  const isBuyer = Boolean(order && order.buyerId === user?.id);

  const contact = (): Promise<ChatPreviewDto | null> =>
    order ? openChat.mutateAsync({ vehicleId: order.vehicleId }).catch(() => null) : Promise.resolve(null);

  return {
    query,
    order,
    isBuyer,
    remaining,
    pending: order?.status === 'PENDING_PAYMENT',
    paid: order?.status === 'PAID',
    rows: order ? receiptRows(order, isBuyer) : [],
    contact,
    contacting: openChat.isPending,
    contactError: openChat.error,
  };
}

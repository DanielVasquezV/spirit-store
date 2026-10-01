import { useSession } from '@/features/auth/session-provider';
import { useOpenChat } from '@/features/chats/use-chats';
import { useBuyNow, usePendingPurchases } from '@/features/orders/use-orders';
import { isNotFound } from '@/lib/api/api-error';
import type { ChatPreviewDto, OrderDto } from '@/lib/types/api';
import { useVehicle } from './use-catalog';
import { canBuyDirectly, liveAuctionOf, pendingOrderFor } from './vehicle-rules';

// Ficha del vehículo: datos, qué acciones le corresponden al usuario y las acciones en sí.
export function useVehicleDetail(id: string | undefined) {
  const { user } = useSession();
  const query = useVehicle(id);
  const buyNow = useBuyNow();
  const openChat = useOpenChat();
  const pendingPurchases = usePendingPurchases();
  const vehicle = query.data;

  // Las acciones devuelven null si fallan: el error ya queda en la mutación para que la vista lo muestre.
  const buy = (): Promise<OrderDto | null> =>
    vehicle ? buyNow.mutateAsync({ vehicleId: vehicle.id, price: vehicle.basePrice }).catch(() => null) : Promise.resolve(null);
  const contact = (): Promise<ChatPreviewDto | null> =>
    vehicle ? openChat.mutateAsync({ vehicleId: vehicle.id }).catch(() => null) : Promise.resolve(null);

  return {
    query,
    vehicle,
    // Un 404 es "no existe"; cualquier otro error es un fallo de carga que vale reintentar.
    loadFailed: query.isError && !isNotFound(query.error),
    isOwn: Boolean(vehicle && vehicle.sellerId === user?.id),
    liveAuction: vehicle ? liveAuctionOf(vehicle) : null,
    buyable: vehicle ? canBuyDirectly(vehicle, user?.id) : false,
    myPendingOrder: vehicle ? pendingOrderFor(vehicle.id, pendingPurchases) : undefined,
    buy,
    buying: buyNow.isPending,
    buyError: buyNow.error,
    contact,
    contacting: openChat.isPending,
    contactError: openChat.error,
  };
}

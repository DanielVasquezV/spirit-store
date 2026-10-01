import type { OrderDto, VehicleDto } from '@/lib/types/api';

// Reglas puras de la ficha: qué puede hacer el usuario con un vehículo según su estado y su relación con él.

export function liveAuctionOf(vehicle: VehicleDto) {
  return vehicle.auction?.status === 'ACTIVE' ? vehicle.auction : null;
}

// Solo se compra directo lo que está disponible y admite venta directa; el resto va por subasta o ya no está.
export function canBuyDirectly(vehicle: VehicleDto, viewerId: string | undefined): boolean {
  return vehicle.status === 'AVAILABLE' && vehicle.saleType !== 'AUCTION' && vehicle.sellerId !== viewerId;
}

// Si ya lo reservó este usuario, la ficha retoma su checkout en vez de intentar otra compra.
export function pendingOrderFor(vehicleId: string, pending: OrderDto[]): OrderDto | undefined {
  return pending.find((order) => order.vehicleId === vehicleId);
}

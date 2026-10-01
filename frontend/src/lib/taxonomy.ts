// Mapeo único de los enums del backend (en inglés) a las etiquetas en español que pinta la UI.

import { groupThousands } from './format';
import {
  FUELS,
  TRANSMISSIONS,
  VEHICLE_CATEGORIES,
  type AuctionStatus,
  type ChatType,
  type Condition,
  type DiagnosticSeverity,
  type DuiStatus,
  type OrderStatus,
  type PaymentMethod,
  type Fuel,
  type SaleType,
  type Transmission,
  type VehicleCategory,
  type VehicleDto,
  type VehicleStatus,
} from './types/api';

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  MANUAL: 'Manual',
  AUTOMATIC: 'Automática',
};

export const FUEL_LABELS: Record<Fuel, string> = {
  GASOLINE: 'Gasolina',
  DIESEL: 'Diésel',
  ELECTRIC: 'Eléctrico',
  HYBRID: 'Híbrido',
};

export const CATEGORY_LABELS: Record<VehicleCategory, string> = {
  SUV: 'SUV',
  SEDAN: 'Sedán',
  SPORT: 'Deportivo',
  ELECTRIC: 'Eléctrico',
  PICKUP: 'Pickup',
  COMPACT: 'Compacto',
};

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como nuevo',
  USED: 'Usado',
  FOR_PARTS: 'Para repuestos',
};

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  DIRECT_SALE: 'Venta directa',
  AUCTION: 'Subasta',
  BOTH: 'Venta y subasta',
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  DRAFT: 'Borrador',
  AVAILABLE: 'Disponible',
  IN_AUCTION: 'En subasta',
  RESERVED: 'Reservado',
  SOLD: 'Vendido',
};

export const AUCTION_STATUS_LABELS: Record<AuctionStatus, string> = {
  PENDING: 'Pendiente',
  ACTIVE: 'En vivo',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
  CLOSED: 'Cerrada sin pago',
};

export const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  PURCHASE: 'Comprando',
  SALE: 'Vendiendo',
  AUCTION_WIN: 'Ganada en subasta',
};

export const SEVERITY_LABELS: Record<DiagnosticSeverity, string> = {
  LOW: 'Leve',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const CATEGORY_OPTIONS = VEHICLE_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));
export const TRANSMISSION_OPTIONS = TRANSMISSIONS.map((value) => ({ value, label: TRANSMISSION_LABELS[value] }));
export const FUEL_OPTIONS = FUELS.map((value) => ({ value, label: FUEL_LABELS[value] }));

// El backend no tiene rangos predefinidos: el sheet envía minPrice y maxPrice reales y los buckets solo agrupan.
export const PRICE_BUCKETS = [
  { id: 'all', label: 'Todos', min: undefined, max: undefined },
  { id: 'lt25', label: 'Menos de $25,000', min: undefined, max: 25000 },
  { id: '25-50', label: '$25,000 – $50,000', min: 25000, max: 50000 },
  { id: '50-100', label: '$50,000 – $100,000', min: 50000, max: 100000 },
  { id: 'gt100', label: 'Más de $100,000', min: 100000, max: undefined },
] as const;

export type PriceBucketId = (typeof PRICE_BUCKETS)[number]['id'];

export function saleBadges(saleType: SaleType): string[] {
  if (saleType === 'BOTH') return [SALE_TYPE_LABELS.DIRECT_SALE, SALE_TYPE_LABELS.AUCTION];
  return [SALE_TYPE_LABELS[saleType]];
}

export function vehicleSpecs(vehicle: { year: number; transmission: Transmission; mileage: number }): string[] {
  return [String(vehicle.year), TRANSMISSION_LABELS[vehicle.transmission], `${groupThousands(vehicle.mileage)} km`];
}
type CardVehicle = Pick<VehicleDto, 'id' | 'saleType' | 'status' | 'basePrice' | 'auction'>;

// Un vehículo vendido o reservado sigue en el catálogo: el badge evita que parezca comprable.
export function vehicleBadges(vehicle: Pick<VehicleDto, 'saleType' | 'status'>): string[] {
  const badges = saleBadges(vehicle.saleType);
  if (vehicle.status === 'SOLD' || vehicle.status === 'RESERVED') badges.push(VEHICLE_STATUS_LABELS[vehicle.status]);
  return badges;
}

// En subasta manda la puja vigente; si nadie pujó, el precio de salida.
export function vehiclePrice(vehicle: CardVehicle): { amount: number; caption?: string } {
  if (vehicle.auction && vehicle.auction.status === 'ACTIVE') {
    return vehicle.auction.currentBid !== null
      ? { amount: vehicle.auction.currentBid, caption: 'Puja actual' }
      : { amount: vehicle.auction.startingPrice, caption: 'Puja inicial' };
  }
  return { amount: vehicle.basePrice };
}

// Un vehículo con subasta viva abre la sala de pujas en vez de la ficha de venta.
export function vehicleHref(vehicle: CardVehicle): `/auction/${string}` | `/product/${string}` {
  return vehicle.auction && vehicle.auction.status === 'ACTIVE' ? `/auction/${vehicle.auction.id}` : `/product/${vehicle.id}`;
}

export function techSpecs(vehicle: VehicleDto): { label: string; value: string }[] {
  return [
    { label: 'Motor', value: vehicle.engine },
    { label: 'Potencia', value: vehicle.power },
    { label: 'Tracción', value: vehicle.drivetrain },
    { label: 'Transmisión', value: TRANSMISSION_LABELS[vehicle.transmission] },
    { label: 'Combustible', value: FUEL_LABELS[vehicle.fuel] },
    { label: 'Kilometraje', value: `${groupThousands(vehicle.mileage)} km` },
    { label: 'Condición', value: CONDITION_LABELS[vehicle.condition] },
    { label: 'Año', value: String(vehicle.year) },
  ];
}

export const DUI_STATUS_LABELS: Record<DuiStatus, string> = {
  NONE: 'Sin cargar',
  PENDING: 'En revisión',
  VERIFIED: 'Verificado',
  REJECTED: 'Rechazado',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PAID: 'Pagada',
  FAILED: 'Fallida',
  CANCELLED: 'Cancelada',
  REFUNDED: 'Reembolsada',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: 'Tarjeta',
  BANK_TRANSFER: 'Transferencia bancaria',
};

// Mapas EN→ES y utilidades de specs/badges derivados de los enums del backend.
// El backend devuelve valores en inglés (MANUAL, AUTOMATIC, GASOLINE…); la UI
// siempre renderiza etiquetas en español. Esto concentra el mapeo en un único punto.

import { groupThousands } from './format';
import {
  FUELS,
  TRANSMISSIONS,
  VEHICLE_CATEGORIES,
  type AuctionStatus,
  type ChatType,
  type Condition,
  type DiagnosticSeverity,
  type Fuel,
  type SaleType,
  type Transmission,
  type VehicleCategory,
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

// El backend no tiene filtros por precio predefined: el sheet envía minPrice y
// maxPrice reales, y los buckets son solo la selección de rangos del picker.
export const PRICE_BUCKETS = [
  { id: 'all', label: 'Todos', min: undefined, max: undefined },
  { id: 'lt25', label: 'Hasta 25,000', min: undefined, max: 25000 },
  { id: '25-50', label: '25,000 - 50,000', min: 25000, max: 50000 },
  { id: '50-100', label: '50,000 - 100,000', min: 50000, max: 100000 },
  { id: 'gt100', label: 'Más de 100,000', min: 100000, max: undefined },
] as const;

export type PriceBucketId = (typeof PRICE_BUCKETS)[number]['id'];

export function saleBadges(saleType: SaleType): string[] {
  if (saleType === 'BOTH') return [SALE_TYPE_LABELS.DIRECT_SALE, SALE_TYPE_LABELS.AUCTION];
  return [SALE_TYPE_LABELS[saleType]];
}

export function vehicleSpecs(vehicle: { year: number; transmission: Transmission; mileage: number }): string[] {
  return [String(vehicle.year), TRANSMISSION_LABELS[vehicle.transmission], `${groupThousands(vehicle.mileage)} km`];
}
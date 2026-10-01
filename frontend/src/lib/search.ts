import type { VehicleFilters } from '@/lib/api/vehicles';
import { PRICE_BUCKETS, type PriceBucketId } from '@/lib/taxonomy';
import type { Fuel, Transmission, VehicleCategory, VehicleDto } from '@/lib/types/api';

export type Filters = {
  price: PriceBucketId;
  category: VehicleCategory | 'all';
  transmission: Transmission | 'all';
  fuel: Fuel | 'all';
};

export const DEFAULT_FILTERS: Filters = {
  price: 'all',
  category: 'all',
  transmission: 'all',
  fuel: 'all',
};

export function hasActiveFilters(filters: Filters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).some((key) => filters[key] !== DEFAULT_FILTERS[key]);
}

function priceRange(id: PriceBucketId): { minPrice?: number; maxPrice?: number } {
  const bucket = PRICE_BUCKETS.find((item) => item.id === id);
  return { minPrice: bucket?.min, maxPrice: bucket?.max };
}

// Traduce el estado de la UI a los query params de GET /vehicles.
export function toVehicleFilters(query: string, filters: Filters): VehicleFilters {
  return {
    q: query.trim() || undefined,
    category: filters.category === 'all' ? undefined : filters.category,
    transmission: filters.transmission === 'all' ? undefined : filters.transmission,
    fuel: filters.fuel === 'all' ? undefined : filters.fuel,
    ...priceRange(filters.price),
  };
}

// Sin acentos para que "merida" encuentre "Mérida", igual que el searchText del backend.
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// GET /auctions no acepta texto ni specs: el filtrado de subastas se resuelve sobre el vehículo embebido.
export function matchesFilters(vehicle: VehicleDto, price: number, query: string, filters: Filters): boolean {
  const q = normalize(query.trim());
  if (q && !normalize(`${vehicle.title} ${vehicle.brand} ${vehicle.model}`).includes(q)) return false;
  if (filters.category !== 'all' && vehicle.category !== filters.category) return false;
  if (filters.transmission !== 'all' && vehicle.transmission !== filters.transmission) return false;
  if (filters.fuel !== 'all' && vehicle.fuel !== filters.fuel) return false;
  const { minPrice, maxPrice } = priceRange(filters.price);
  if (minPrice !== undefined && price < minPrice) return false;
  if (maxPrice !== undefined && price > maxPrice) return false;
  return true;
}

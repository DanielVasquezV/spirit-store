import { http, type Paginated } from './http-client';
import type {
  Fuel,
  SaleType,
  Transmission,
  VehicleCategory,
  VehicleDto,
  VehicleStatus,
} from '@/lib/types/api';

export interface VehicleFilters {
  q?: string;
  category?: VehicleCategory;
  fuel?: Fuel;
  transmission?: Transmission;
  saleType?: SaleType;
  status?: VehicleStatus;
  minPrice?: number;
  maxPrice?: number;
  sellerId?: string;
}

export function listVehicles(
  filters: VehicleFilters,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<Paginated<VehicleDto>> {
  return http.paginated<VehicleDto>('/vehicles', { query: { ...filters, page, pageSize }, signal });
}

export function listMyVehicles(page: number, pageSize: number): Promise<Paginated<VehicleDto>> {
  return http.paginated<VehicleDto>('/vehicles/mine', { query: { page, pageSize } });
}

export function getVehicle(id: string, signal?: AbortSignal): Promise<VehicleDto> {
  return http.get<VehicleDto>(`/vehicles/${id}`, { signal });
}
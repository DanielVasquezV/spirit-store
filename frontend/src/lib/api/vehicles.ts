import { http, type Paginated } from './http-client';
import type {
  Condition,
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
export interface CreateVehicleInput {
  vin: string;
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  transmission: Transmission;
  fuel: Fuel;
  category: VehicleCategory;
  engine: string;
  power: string;
  drivetrain: string;
  condition?: Condition;
  color?: string;
  basePrice: number;
  saleType: SaleType;
  description?: string;
  images?: { url: string; publicId?: string }[];
  auction?: { startingPrice: number; endTime: string; startTime?: string; minBidIncrement?: number };
}

export type UpdateVehicleInput = Partial<Omit<CreateVehicleInput, 'vin' | 'licensePlate' | 'saleType' | 'images' | 'auction'>> & {
  status?: 'DRAFT' | 'AVAILABLE';
};

export function createVehicle(input: CreateVehicleInput): Promise<VehicleDto> {
  return http.post<VehicleDto>('/vehicles', input);
}

export function updateVehicle(id: string, input: UpdateVehicleInput): Promise<VehicleDto> {
  return http.patch<VehicleDto>(`/vehicles/${id}`, input);
}

export function deleteVehicle(id: string): Promise<void> {
  return http.delete(`/vehicles/${id}`);
}

export interface TaxonomyOption {
  value: string;
  label: string;
}

export type Taxonomies = Record<string, TaxonomyOption[]>;

export function getTaxonomies(): Promise<Taxonomies> {
  return http.get<Taxonomies>('/taxonomies');
}

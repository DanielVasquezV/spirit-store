import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createVehicle, listMyVehicles, listVehicles, getVehicle, type CreateVehicleInput, type VehicleFilters } from '@/lib/api/vehicles';
import { useIsAuthenticated } from '@/features/auth/session-provider';
import type { Paginated } from '@/lib/api/http-client';

const PAGE_SIZE = 20;
// El backend no tiene flag "featured": destacados son los últimos publicados disponibles.
const FEATURED_LIMIT = 6;

export const catalogKeys = {
  all: ['vehicles'] as const,
  list: (filters: VehicleFilters) => ['vehicles', 'list', filters] as const,
  featured: ['vehicles', 'featured'] as const,
  detail: (id: string) => ['vehicles', 'detail', id] as const,
  mine: ['vehicles', 'mine'] as const,
};

function nextPage(last: Paginated<unknown>): number | undefined {
  return last.page < last.totalPages ? last.page + 1 : undefined;
}

export function flattenPages<T>(pages: Paginated<T>[] | undefined): T[] {
  return pages?.flatMap((page) => page.items) ?? [];
}

export function useFeaturedVehicles() {
  return useQuery({
    queryKey: catalogKeys.featured,
    queryFn: ({ signal }) => listVehicles({ status: 'AVAILABLE' }, 1, FEATURED_LIMIT, signal),
  });
}

export function useVehicleSearch(filters: VehicleFilters) {
  return useInfiniteQuery({
    queryKey: catalogKeys.list(filters),
    queryFn: ({ pageParam, signal }) => listVehicles(filters, pageParam, PAGE_SIZE, signal),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    // Mantiene la lista anterior mientras llega la del filtro nuevo: sin parpadeo a vacío.
    placeholderData: keepPreviousData,
  });
}

export function useVehicle(id: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.detail(id ?? ''),
    queryFn: ({ signal }) => getVehicle(id!, signal),
    enabled: Boolean(id),
  });
}

export function useMyVehicles() {
  const authed = useIsAuthenticated();
  return useInfiniteQuery({
    enabled: authed,
    queryKey: catalogKeys.mine,
    queryFn: ({ pageParam }) => listMyVehicles(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}


// Publicar refresca catálogo y subastas: el vehículo nuevo puede aparecer en cualquiera de los dos.
export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVehicleInput) => createVehicle(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
  });
}

import { useMemo, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { DEFAULT_FILTERS, hasActiveFilters, toVehicleFilters, type Filters } from '@/lib/search';
import { VEHICLE_CATEGORIES, type VehicleCategory } from '@/lib/types/api';
import { flattenPages, useVehicleSearch } from './use-catalog';

// Texto + filtros del catálogo; lo comparten Buscar y Subastas en vivo.
export function useCatalogFilters(initial: Partial<Filters> = {}, initialQuery = '') {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<Filters>(() => ({ ...DEFAULT_FILTERS, ...initial }));

  const updateFilter = (update: Partial<Filters>) => setFilters((current) => ({ ...current, ...update }));
  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const resetAll = () => {
    setQuery('');
    resetFilters();
  };
  const filtered = hasActiveFilters(filters);

  return { query, setQuery, filters, setFilters, updateFilter, resetFilters, resetAll, filtered, searching: Boolean(query.trim()) || filtered };
}

function toCategory(raw: string | undefined): Filters['category'] {
  return VEHICLE_CATEGORIES.includes(raw as VehicleCategory) ? (raw as VehicleCategory) : 'all';
}

// Buscar: filtros + params que llegan desde Home + consulta paginada a GET /vehicles.
export function useCatalogSearch(params: { q?: string; category?: string }) {
  const state = useCatalogFilters({ category: toCategory(params.category) }, params.q ?? '');
  const { setQuery, setFilters } = state;

  // La pestaña queda montada: los params que llegan desde Home después del primer render se aplican en el render.
  const [seenParams, setSeenParams] = useState(params);
  if (params.q !== seenParams.q || params.category !== seenParams.category) {
    setSeenParams(params);
    if (params.q !== undefined && params.q !== seenParams.q) setQuery(params.q);
    if (params.category !== undefined && params.category !== seenParams.category) {
      setFilters((current) => ({ ...current, category: toCategory(params.category) }));
    }
  }

  const debouncedQuery = useDebouncedValue(state.query);
  const apiFilters = useMemo(() => toVehicleFilters(debouncedQuery, state.filters), [debouncedQuery, state.filters]);
  const search = useVehicleSearch(apiFilters);

  return { ...state, search, results: flattenPages(search.data?.pages), total: search.data?.pages[0]?.total ?? 0 };
}

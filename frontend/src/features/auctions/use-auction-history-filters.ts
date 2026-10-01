import { useMemo, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { AuctionHistoryFilters } from '@/lib/api/auctions';
import type { AuctionStatus } from '@/lib/types/api';
import { useAuctionHistory } from './use-auctions';

export type HistoryRoleFilter = NonNullable<AuctionHistoryFilters['role']> | 'all';
export type HistoryStatusFilter = AuctionStatus | 'all';

// Estado de los filtros del registro y la consulta que dispara; la vista solo pinta y llama a los setters.
export function useAuctionHistoryFilters() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<HistoryRoleFilter>('all');
  const [status, setStatus] = useState<HistoryStatusFilter>('all');
  const debouncedQuery = useDebouncedValue(query);

  const filters = useMemo<AuctionHistoryFilters>(
    () => ({
      role: role === 'all' ? undefined : role,
      status: status === 'all' ? undefined : status,
      q: debouncedQuery.trim() || undefined,
    }),
    [role, status, debouncedQuery],
  );
  const history = useAuctionHistory(filters);

  const reset = () => {
    setQuery('');
    setRole('all');
    setStatus('all');
  };

  return {
    query,
    setQuery,
    role,
    setRole,
    status,
    setStatus,
    reset,
    filtered: role !== 'all' || status !== 'all' || Boolean(query.trim()),
    history,
    items: history.data?.pages.flatMap((page) => page.items) ?? [],
    total: history.data?.pages[0]?.total ?? 0,
  };
}

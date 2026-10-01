import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/session-provider';
import { getAuction, listAuctions, listMyAuctions, listMyBids, type AuctionHistoryFilters } from '@/lib/api/auctions';
import type { Paginated } from '@/lib/api/http-client';

const PAGE_SIZE = 20;

export const auctionKeys = {
  active: ['auctions', 'active'] as const,
  detail: (id: string) => ['auctions', 'detail', id] as const,
  myBids: ['bids', 'mine'] as const,
  history: (filters: AuctionHistoryFilters) => ['auctions', 'history', filters] as const,
  historyAll: ['auctions', 'history'] as const,
};

function nextPage(last: Paginated<unknown>): number | undefined {
  return last.page < last.totalPages ? last.page + 1 : undefined;
}

export function useActiveAuctions() {
  return useInfiniteQuery({
    queryKey: auctionKeys.active,
    queryFn: ({ pageParam }) => listAuctions({ status: 'ACTIVE' }, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

// Sin sesión no hay socket (el handshake exige JWT): el invitado ve la subasta en vivo por polling.
const GUEST_POLL_MS = 5000;

export function useAuction(id: string | undefined, { poll = false }: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: auctionKeys.detail(id ?? ''),
    queryFn: () => getAuction(id!),
    enabled: Boolean(id),
    refetchInterval: poll ? GUEST_POLL_MS : false,
  });
}

export function useMyBids() {
  const authed = useIsAuthenticated();
  return useInfiniteQuery({
    enabled: authed,
    queryKey: auctionKeys.myBids,
    queryFn: ({ pageParam }) => listMyBids(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

export function useAuctionHistory(filters: AuctionHistoryFilters) {
  const authed = useIsAuthenticated();
  return useInfiniteQuery({
    enabled: authed,
    queryKey: auctionKeys.history(filters),
    queryFn: ({ pageParam }) => listMyAuctions(filters, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    // Cambiar un filtro mantiene la lista anterior hasta que llega la nueva: sin parpadeo a vacío.
    placeholderData: keepPreviousData,
  });
}

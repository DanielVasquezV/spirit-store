import { useCatalogFilters } from '@/features/catalog/use-catalog-filters';
import { flattenPages } from '@/features/catalog/use-catalog';
import { matchesFilters } from '@/lib/search';
import { currentPrice } from './auction-rules';
import { useActiveAuctions } from './use-auctions';

// Subastas en vivo con los mismos filtros del catálogo; GET /auctions no filtra, así que se aplica acá.
export function useLiveAuctionList() {
  const state = useCatalogFilters();
  const auctions = useActiveAuctions();
  const all = flattenPages(auctions.data?.pages);
  const results = all.filter((auction) => matchesFilters(auction.vehicle, currentPrice(auction), state.query, state.filters));
  return { ...state, auctions, all, results };
}

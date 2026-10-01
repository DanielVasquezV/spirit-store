import { http, type Paginated } from './http-client';
import type { AuctionDto, AuctionStatus, BidDto, MyBidDto } from '@/lib/types/api';

export interface AuctionFilters {
  status?: AuctionStatus;
  sellerId?: string;
  vehicleId?: string;
}

export interface PlaceBidResult {
  bid: BidDto;
  auction: AuctionDto;
  minimumNextBid: number;
}

export function listAuctions(
  filters: AuctionFilters,
  page: number,
  pageSize: number,
): Promise<Paginated<AuctionDto>> {
  return http.paginated<AuctionDto>('/auctions', { query: { ...filters, page, pageSize } });
}

export function getAuction(id: string): Promise<AuctionDto> {
  return http.get<AuctionDto>(`/auctions/${id}`);
}

export function listAuctionBids(auctionId: string, page: number, pageSize: number): Promise<Paginated<BidDto>> {
  return http.paginated<BidDto>(`/auctions/${auctionId}/bids`, { query: { page, pageSize } });
}

export function placeBid(auctionId: string, amount: number): Promise<PlaceBidResult> {
  return http.post<PlaceBidResult>(`/auctions/${auctionId}/bids`, { amount });
}

export function listMyBids(page: number, pageSize: number): Promise<Paginated<MyBidDto>> {
  return http.paginated<MyBidDto>('/bids/mine', { query: { page, pageSize } });
}
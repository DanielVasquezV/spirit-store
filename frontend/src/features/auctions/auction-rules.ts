import { Colors } from '@/constants/theme';
import { formatPriceParts } from '@/lib/format';
import type { AuctionDto, AuctionHistoryItemDto, MyBidDto, OrderDto } from '@/lib/types/api';

// Reglas puras de subastas: sin React ni red, para que las vistas solo pinten lo que devuelven.

export const currentPrice = (auction: Pick<AuctionDto, 'currentBid' | 'startingPrice'>) => auction.currentBid ?? auction.startingPrice;

export type AuctionCtaAction = 'pay' | 'sign-in' | 'upload-dui' | 'bid' | 'none';

export interface AuctionCtaInput {
  closed: boolean;
  pending: boolean;
  isGuest: boolean;
  isOwner: boolean;
  needsDui: boolean;
  bidding: boolean;
  nextStep: number;
  wonOrder: OrderDto | undefined;
}

// El orden de los casos es la prioridad: ganar y deber el pago pesa más que cualquier otro estado.
export function auctionCta(input: AuctionCtaInput): { label: string; action: AuctionCtaAction; disabled: boolean } {
  if (input.wonOrder) return { label: 'Ganaste · Pagar mi compra', action: 'pay', disabled: false };
  if (input.closed) return { label: 'Subasta cerrada', action: 'none', disabled: true };
  if (input.pending) return { label: 'Aún no comienza', action: 'none', disabled: true };
  if (input.isGuest) return { label: 'Iniciá sesión para pujar', action: 'sign-in', disabled: false };
  if (input.isOwner) return { label: 'Es tu subasta', action: 'none', disabled: true };
  if (input.needsDui) return { label: 'Cargá tu DUI para pujar', action: 'upload-dui', disabled: false };
  if (input.bidding) return { label: 'Enviando puja…', action: 'none', disabled: true };
  return { label: `Pujar $${formatPriceParts(input.nextStep).whole}`, action: 'bid', disabled: false };
}

export interface HistoryOutcome {
  text: string;
  tone: string;
  payNow: boolean;
}

// Qué le pasó a la venta según la orden del cierre y quién mira.
export function historyOutcome(item: AuctionHistoryItemDto): HistoryOutcome | null {
  if (item.status === 'CLOSED') return { text: 'El ganador no pagó: cerrada sin venta', tone: Colors.danger, payNow: false };
  if (item.status !== 'FINISHED') return null;
  if (!item.currentWinner) return { text: 'Terminó sin pujas', tone: Colors.textMuted, payNow: false };
  if (item.myRole === 'BIDDER') return { text: `Ganó ${item.currentWinner.fullName}`, tone: Colors.textMuted, payNow: false };
  if (item.order?.status === 'PAID') return { text: item.myRole === 'SELLER' ? 'Vendida y pagada' : 'Compra pagada', tone: Colors.success, payNow: false };
  if (item.order?.status === 'PENDING_PAYMENT') {
    return item.myRole === 'SELLER'
      ? { text: `Esperando el pago de ${item.currentWinner.fullName}`, tone: Colors.warning, payNow: false }
      : { text: 'Ganaste: falta pagar · Pagar', tone: Colors.warning, payNow: true };
  }
  return null;
}

// Destino al tocar una fila del registro: pagar si se debe, el comprobante si ya se pagó, o la subasta.
export function historyHref(item: AuctionHistoryItemDto): `/checkout/${string}` | `/purchase/${string}` | `/auction/${string}` {
  const result = historyOutcome(item);
  if (result?.payNow && item.order) return `/checkout/${item.order.id}`;
  if (item.order && item.myRole !== 'BIDDER' && item.order.status === 'PAID') return `/purchase/${item.order.id}`;
  return `/auction/${item.id}`;
}

// /bids/mine trae cada puja: para "subastas seguidas" basta la más reciente de cada subasta.
export function latestBidPerAuction(bids: MyBidDto[]): MyBidDto[] {
  const seen = new Map<string, MyBidDto>();
  for (const bid of bids) if (!seen.has(bid.auction.id)) seen.set(bid.auction.id, bid);
  return [...seen.values()];
}

export function isLeadingBid(bid: MyBidDto): boolean {
  return bid.auction.currentBid !== null && bid.amount >= bid.auction.currentBid;
}

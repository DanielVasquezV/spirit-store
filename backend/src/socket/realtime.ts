import type { AuctionStatus } from '../generated/prisma/client.js';

// Los servicios no conocen la instancia de Socket.io: empujan aca y el servidor
// de sockets se engancha con `setAuctionRealtimeSink` al arrancar. Asi el modulo
// de subastas se puede ejercitar sin levantar sockets y, mas importante, un
// error al emitir nunca tumba una puja que ya quedo escrita en la base.

export interface RealtimeBid {
  id: string;
  amount: number;
  createdAt: string;
  bidder: { id: string; fullName: string };
}

export interface BidPlacedEvent {
  auctionId: string;
  bid: RealtimeBid;
  /** Estado del contador despues de la puja, para que el cliente no dependa de
   *  haber recibido todas las intermedias. */
  currentBid: number;
  minBidIncrement: number;
  /** Cuanto tiene que poner el siguiente postor, ya redondeado a centavos. */
  minimumNextBid: number;
  bidCount: number;
  currentWinner: { id: string; fullName: string } | null;
}

export interface OutbidEvent {
  auctionId: string;
  /** A quien hay que avisarle: el que tenia la puja mas alta hasta hace un
   *  instante. Va a la sala personal, para que se entere aunque no este
   *  mirando la pantalla de la subasta. */
  previousWinnerId: string;
  currentBid: number;
  minimumNextBid: number;
}

export interface AuctionStartedEvent {
  auctionId: string;
  startingPrice: number;
  minBidIncrement: number;
}

export interface AuctionClosedEvent {
  auctionId: string;
  vehicleId: string;
  status: AuctionStatus;
  /** Null cuando la subasta termino sin pujas: entonces el vehiculo vuelve al
   *  catalogo en vez de quedarse vendido. */
  winnerId: string | null;
  currentBid: number | null;
  /** Orden que el ganador tiene que pagar para quedarse con el vehículo. */
  orderId: string | null;
}

export interface AuctionRealtimeSink {
  bidPlaced(event: BidPlacedEvent): void;
  outbid(event: OutbidEvent): void;
  started(event: AuctionStartedEvent): void;
  closed(event: AuctionClosedEvent): void;
}

const NOOP_SINK: AuctionRealtimeSink = {
  bidPlaced: () => undefined,
  outbid: () => undefined,
  started: () => undefined,
  closed: () => undefined,
};

let sink: AuctionRealtimeSink = NOOP_SINK;

export function setAuctionRealtimeSink(next: AuctionRealtimeSink | null): void {
  sink = next ?? NOOP_SINK;
}

/** Enviar a una sala sin escuchas no es un error: es lo normal. */
function safeEmit(what: string, emit: () => void): void {
  try {
    emit();
  } catch (err) {
    console.error(`[realtime] no se pudo emitir ${what}:`, err);
  }
}

export const emitBidPlaced = (event: BidPlacedEvent): void =>
  safeEmit('auction:bid-placed', () => sink.bidPlaced(event));
export const emitOutbid = (event: OutbidEvent): void =>
  safeEmit('auction:outbid', () => sink.outbid(event));
export const emitAuctionStarted = (event: AuctionStartedEvent): void =>
  safeEmit('auction:started', () => sink.started(event));
export const emitAuctionClosed = (event: AuctionClosedEvent): void =>
  safeEmit('auction:closed', () => sink.closed(event));
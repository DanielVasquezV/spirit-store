import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { decimalString, fromCents, hasAtMostTwoDecimals, toCents } from '../../lib/money.js';
import { emitAuctionClosed, emitBidPlaced, emitOutbid } from '../../socket/realtime.js';
import { AUCTION_INCLUDE, toAuctionDto } from '../auction/auction.service.js';
import type { AuctionDto, BidDto } from '../auction/auction.service.js';
import { finalizeAuction, lockAuctionRow, minimumNextBid } from '../auction/auction.state.js';
import type { Requester } from '../vehicle/vehicle.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

// Alta de pujas. Toda la validacion ocurre adentro de una transaccion que
// bloquea la fila de la subasta (ver `lockAuctionRow`): sin ese bloqueo, dos
// pujas concurrentes leen la misma `currentBid` y las dos pasan el minimo.

const BID_INCLUDE = {
  bidder: { select: { id: true, fullName: true } },
} as const satisfies Prisma.BidInclude;

type BidRow = Prisma.BidGetPayload<{ include: typeof BID_INCLUDE }>;

function toBidDto(row: BidRow): BidDto {
  return {
    id: row.id,
    amount: Number(row.amount),
    createdAt: row.createdAt.toISOString(),
    bidder: { id: row.bidder.id, fullName: row.bidder.fullName },
  };
}

export interface PlaceBidResult {
  bid: BidDto;
  /** La subasta ya con la puja aplicada. Se devuelve entera para que la app
   *  actualice contador, ganador y minimo siguiente sin un segundo round-trip. */
  auction: AuctionDto;
  /** A quien hay que avisarle que fue desplazado, si alguien lo fue. */
  outbidUserId: string | null;
  minimumNextBid: number;
}

export async function placeBid(
  auctionId: string,
  requester: Requester,
  amount: number,
): Promise<PlaceBidResult> {
  if (!hasAtMostTwoDecimals(amount)) {
    throw AppError.badRequest('Validation failed', { amount: 'amount admite como maximo 2 decimales' });
  }
  const amountCents = toCents(amount);
  if (amountCents <= 0) {
    throw AppError.badRequest('Validation failed', { amount: 'amount debe ser mayor a 0' });
  }

  const result = await prisma.$transaction(async (tx) => {
    if (!(await lockAuctionRow(tx, auctionId))) throw AppError.notFound('Auction');

    const auction = await tx.auction.findUnique({ where: { id: auctionId }, include: AUCTION_INCLUDE });
    if (!auction || auction.vehicle.deletedAt !== null) throw AppError.notFound('Auction');

    // Una subasta vencida pero todavia marcada ACTIVE (el timer corre cada 15s y
    // puede no haber pasado todavia) se cierra aca: sin esto, una puja entre el
    // `endTime` y el siguiente tick se aceptaria en una subasta ya terminada.
    //
    // OJO con devolver en vez de tirar: un `throw` aca adentro revierte la
    // transaccion, y con ella el cierre que se acaba de hacer. El error se tira
    // despues del commit.
    if (auction.status === 'ACTIVE' && auction.endTime.getTime() <= Date.now()) {
      const closure = await finalizeAuction(tx, auctionId);
      return { expired: true as const, closure };
    }

    if (auction.status !== 'ACTIVE') {
      throw AppError.conflict(conflictMessage(auction.status));
    }

    if (auction.sellerId === requester.id) {
      throw AppError.forbidden('No podes pujar en tu propia subasta');
    }

    // Pujar por encima de la propia puja no compra nada (no hay escrow) y un
    // doble toque en la app es la forma natural de pagar dos veces por error.
    if (auction.currentWinnerId === requester.id) {
      throw AppError.conflict('Ya sos el ganador actual de esta subasta');
    }

    const minimum = minimumNextBid(auction.currentBid, auction.startingPrice, auction.minBidIncrement);
    if (amountCents < minimum) {
      throw AppError.conflict('La puja no alcanza el minimo', {
        minimum: fromCents(minimum),
        currentBid: auction.currentBid === null ? null : Number(auction.currentBid),
        minBidIncrement: Number(auction.minBidIncrement),
      });
    }

    const previousWinnerId = auction.currentWinnerId;

    const bid = await tx.bid.create({
      data: { auctionId, bidderId: requester.id, amount: decimalString(amountCents) },
      include: BID_INCLUDE,
    });

    // Denormalizado en la misma transaccion que la puja: `currentBid` y
    // `currentWinnerId` nunca pueden divergir de MAX(BIDS).
    await tx.auction.update({
      where: { id: auctionId },
      data: { currentBid: decimalString(amountCents), currentWinnerId: requester.id },
    });

    const updated = await tx.auction.findUniqueOrThrow({ where: { id: auctionId }, include: AUCTION_INCLUDE });

    return {
      expired: false as const,
      bid: toBidDto(bid),
      auction: toAuctionDto(updated),
      // El ganador anterior solo se avisa si era otro: si ya era el mismo
      // postor, el chequeo de "ya sos el ganador" habria cortado antes.
      outbidUserId: previousWinnerId,
      // Va en centavos adentro de la transaccion (comparar es mas seguro ahi) y
      // sale en unidades, que es como la API expone los montos.
      minimumNextBid: fromCents(amountCents + toCents(Number(auction.minBidIncrement))),
    };
  });

  if (result.expired) {
    if (result.closure) emitAuctionClosed(result.closure);
    throw AppError.conflict('La subasta ya termino');
  }

  // Los eventos salen despues del commit: emitirlos adentro dejaria viendo a los
  // clientes una puja que todavia puede fallar y volver atras.
  emitBidPlaced({
    auctionId,
    bid: result.bid,
    currentBid: result.bid.amount,
    minBidIncrement: result.auction.minBidIncrement,
    minimumNextBid: result.minimumNextBid,
    bidCount: result.auction.bidCount,
    currentWinner: result.auction.currentWinner,
  });
  if (result.outbidUserId) {
    emitOutbid({
      auctionId,
      previousWinnerId: result.outbidUserId,
      currentBid: result.bid.amount,
      minimumNextBid: result.minimumNextBid,
    });
  }

  return {
    bid: result.bid,
    auction: result.auction,
    outbidUserId: result.outbidUserId,
    minimumNextBid: result.minimumNextBid,
  };
}

function conflictMessage(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'La subasta todavia no empezo';
    case 'CANCELLED':
      return 'La subasta fue cancelada';
    case 'FINISHED':
      return 'La subasta ya termino';
    default:
      return 'La subasta no admite pujas';
  }
}

export interface BidPage {
  rows: BidDto[];
  total: number;
}

/**
 * Historial completo de una subasta, paginado. El detalle de la subasta solo
 * trae las ultimas 10; esta es la fuente para "ver todas las pujas".
 */
export async function listAuctionBids(
  auctionId: string,
  page: { skip: number; take: number },
): Promise<BidPage> {
  const auction = await prisma.auction.findFirst({
    where: { id: auctionId, vehicle: { deletedAt: null } },
    select: { id: true },
  });
  if (!auction) throw AppError.notFound('Auction');

  const [total, rows] = await prisma.$transaction([
    prisma.bid.count({ where: { auctionId } }),
    prisma.bid.findMany({
      where: { auctionId },
      include: BID_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: page.skip,
      take: page.take,
    }),
  ]);
  return { rows: rows.map(toBidDto), total };
}

export interface MyBidDto extends BidDto {
  /** Contexto minimo para pintar "mi puja" sin otro request por fila. */
  auction: {
    id: string;
    vehicleId: string;
    status: AuctionDto['status'];
    endTime: string;
    currentBid: number | null;
  };
}

export interface MyBidPage {
  rows: MyBidDto[];
  total: number;
}

const MY_BID_INCLUDE = {
  ...BID_INCLUDE,
  auction: { select: { id: true, vehicleId: true, status: true, endTime: true, currentBid: true } },
} as const satisfies Prisma.BidInclude;

export async function listMyBids(
  bidderId: string,
  page: { skip: number; take: number },
): Promise<MyBidPage> {
  const [total, rows] = await prisma.$transaction([
    prisma.bid.count({ where: { bidderId } }),
    prisma.bid.findMany({
      where: { bidderId },
      include: MY_BID_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: page.skip,
      take: page.take,
    }),
  ]);

  return {
    rows: rows.map((row) => ({
      ...toBidDto(row),
      auction: {
        id: row.auction.id,
        vehicleId: row.auction.vehicleId,
        status: row.auction.status,
        endTime: row.auction.endTime.toISOString(),
        currentBid: row.auction.currentBid === null ? null : Number(row.auction.currentBid),
      },
    })),
    total,
  };
}
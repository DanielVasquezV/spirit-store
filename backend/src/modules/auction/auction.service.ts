import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { lockAuctionRow } from './auction.state.js';
import { toVehicleDto, VEHICLE_INCLUDE } from '../vehicle/vehicle.service.js';
import type { Requester, VehicleDto } from '../vehicle/vehicle.service.js';
import type { AuctionStatus, Prisma } from '../../generated/prisma/client.js';

// Las pujas se leen aca (la app muestra "participantes recientes") y se escriben
// en el modulo de pujas (`bid.service.ts`), que bloquea esta misma fila para
// que dos pujas simultaneas no se pisen.
export const AUCTION_INCLUDE = {
  vehicle: { include: VEHICLE_INCLUDE },
  seller: { select: { id: true, fullName: true } },
  currentWinner: { select: { id: true, fullName: true } },
  bids: {
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { bidder: { select: { id: true, fullName: true } } },
  },
  _count: { select: { bids: true } },
} as const satisfies Prisma.AuctionInclude;

type AuctionRow = Prisma.AuctionGetPayload<{ include: typeof AUCTION_INCLUDE }>;

export interface BidDto {
  id: string;
  amount: number;
  createdAt: string;
  bidder: { id: string; fullName: string };
}

export interface AuctionDto {
  id: string;
  vehicleId: string;
  sellerId: string;
  startingPrice: number;
  currentBid: number | null;
  minBidIncrement: number;
  currentWinner: { id: string; fullName: string } | null;
  startTime: string;
  endTime: string;
  status: AuctionStatus;
  bidCount: number;
  /** Pujas mas recientes, de la mas nueva a la mas vieja. Solo lectura. */
  recentBids: BidDto[];
  vehicle: VehicleDto;
  seller: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export function toAuctionDto(row: AuctionRow): AuctionDto {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    sellerId: row.sellerId,
    startingPrice: Number(row.startingPrice),
    currentBid: row.currentBid === null ? null : Number(row.currentBid),
    minBidIncrement: Number(row.minBidIncrement),
    currentWinner: row.currentWinner ? { id: row.currentWinner.id, fullName: row.currentWinner.fullName } : null,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    status: row.status,
    bidCount: row._count.bids,
    recentBids: row.bids.map((bid) => ({
      id: bid.id,
      amount: Number(bid.amount),
      createdAt: bid.createdAt.toISOString(),
      bidder: { id: bid.bidder.id, fullName: bid.bidder.fullName },
    })),
    vehicle: toVehicleDto(row.vehicle),
    seller: { id: row.seller.id, fullName: row.seller.fullName },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface AuctionFilters {
  status?: AuctionStatus;
  sellerId?: string;
  vehicleId?: string;
}

export interface AuctionPage {
  rows: AuctionDto[];
  total: number;
}

// Una subasta de un vehiculo dado de baja no se muestra: el vehiculo sigue en
// la base por trazabilidad, pero su subasta no deberia aparecer en el listado.
function buildWhere(filters: AuctionFilters): Prisma.AuctionWhereInput {
  const where: Prisma.AuctionWhereInput = { vehicle: { deletedAt: null } };
  if (filters.status) where.status = filters.status;
  if (filters.sellerId) where.sellerId = filters.sellerId;
  if (filters.vehicleId) where.vehicleId = filters.vehicleId;
  return where;
}

export async function listAuctions(
  filters: AuctionFilters,
  page: { skip: number; take: number },
): Promise<AuctionPage> {
  const where = buildWhere(filters);
  const [total, rows] = await prisma.$transaction([
    prisma.auction.count({ where }),
    prisma.auction.findMany({
      where,
      include: AUCTION_INCLUDE,
      // Las que cierran antes primero: es el orden en que le importan a quien
      // mira el listado.
      orderBy: { endTime: 'asc' },
      skip: page.skip,
      take: page.take,
    }),
  ]);
  return { rows: rows.map(toAuctionDto), total };
}

export async function getAuctionById(id: string): Promise<AuctionDto | null> {
  const row = await prisma.auction.findFirst({ where: { id, vehicle: { deletedAt: null } }, include: AUCTION_INCLUDE });
  return row ? toAuctionDto(row) : null;
}

function assertCanManage(sellerId: string, requester: Requester): void {
  if (sellerId !== requester.id && requester.role !== 'ADMIN') {
    throw AppError.forbidden('Solo el vendedor de la subasta puede modificarla');
  }
}

export interface CreateAuctionInput {
  vehicleId: string;
  startingPrice: number;
  startTime?: Date;
  endTime: Date;
  minBidIncrement?: number;
}

export async function createAuction(
  requester: Requester,
  input: CreateAuctionInput,
): Promise<AuctionDto> {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: input.vehicleId, deletedAt: null } });
  if (!vehicle) throw AppError.notFound('Vehicle');
  if (vehicle.sellerId !== requester.id && requester.role !== 'ADMIN') {
    throw AppError.forbidden('Solo el vendedor puede subastar su vehiculo');
  }
  if (vehicle.saleType === 'DIRECT_SALE') {
    throw AppError.badRequest('El vehiculo esta marcado como venta directa y no admite subasta');
  }

  const existing = await prisma.auction.findUnique({ where: { vehicleId: input.vehicleId } });
  if (existing) throw AppError.conflict('El vehiculo ya tiene una subasta asociada');

  const startTime = input.startTime ?? new Date();
  const status: AuctionStatus = startTime.getTime() <= Date.now() ? 'ACTIVE' : 'PENDING';

  // Primero se marca el vehiculo y recien despues se lee la subasta con sus
  // relaciones: si el `include` corriera antes del update, el `vehicle.status`
  // anidado en la respuesta seria el viejo (AVAILABLE) y no IN_AUCTION.
  await prisma.$transaction([
    prisma.auction.create({
      data: {
        vehicleId: input.vehicleId,
        sellerId: vehicle.sellerId,
        startingPrice: input.startingPrice,
        minBidIncrement: input.minBidIncrement,
        startTime,
        endTime: input.endTime,
        status,
      },
    }),
    prisma.vehicle.update({ where: { id: input.vehicleId }, data: { status: 'IN_AUCTION' } }),
  ]);

  const row = await prisma.auction.findUniqueOrThrow({ where: { vehicleId: input.vehicleId }, include: AUCTION_INCLUDE });
  return toAuctionDto(row);
}

export interface UpdateAuctionInput {
  startingPrice?: number;
  startTime?: Date;
  endTime?: Date;
  minBidIncrement?: number;
}

export async function updateAuction(
  id: string,
  requester: Requester,
  input: UpdateAuctionInput,
): Promise<AuctionDto> {
  const current = await prisma.auction.findUnique({ where: { id } });
  if (!current) throw AppError.notFound('Auction');
  assertCanManage(current.sellerId, requester);
  // Una vez que hay pujas, mover el precio de salida reescribiria la historia:
  // solo se edita mientras siga PENDING.
  if (current.status !== 'PENDING') {
    throw AppError.conflict('Solo se puede editar una subasta que todavia no empezo');
  }

  const startTime = input.startTime ?? current.startTime;
  const endTime = input.endTime ?? current.endTime;
  if (startTime.getTime() >= endTime.getTime()) {
    throw AppError.badRequest('startTime debe ser anterior a endTime', {
      endTime: 'Debe ser posterior a startTime',
    });
  }
  // Recortar el cierre al pasado dejaria una subasta que nasca terminada.
  if (endTime.getTime() <= Date.now()) {
    throw AppError.badRequest('endTime debe ser una fecha futura', {
      endTime: 'Debe ser posterior a la hora actual',
    });
  }

  const row = await prisma.auction.update({
    where: { id },
    data: {
      ...(input.startingPrice !== undefined ? { startingPrice: input.startingPrice } : {}),
      ...(input.minBidIncrement !== undefined ? { minBidIncrement: input.minBidIncrement } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
    },
    include: AUCTION_INCLUDE,
  });

  return toAuctionDto(row);
}

export async function cancelAuction(id: string, requester: Requester): Promise<void> {
  const current = await prisma.auction.findUnique({ where: { id } });
  if (!current) throw AppError.notFound('Auction');
  assertCanManage(current.sellerId, requester);
  if (current.status === 'FINISHED') {
    throw AppError.conflict('Una subasta finalizada no se puede cancelar');
  }

  // Cancelar devuelve el vehiculo al catalogo en vez de dejarlo en IN_AUCTION
  // para siempre. Si ya se vendio (SOLD) no se toca.
  //
  // Comparte el bloqueo de fila con el alta de pujas: sin el, cancelar mientras
  // hay una puja en vuelo deja la subasta CANCELLED con una puja aceptada
  // despues (si cancela primero) o una puja perdida en una subasta activa.
  await prisma.$transaction(async (tx) => {
    await lockAuctionRow(tx, id);
    const fresh = await tx.auction.findUnique({ where: { id }, select: { status: true } });
    // Pudo terminar entre la lectura de arriba y el lock.
    if (!fresh || fresh.status === 'FINISHED') {
      throw AppError.conflict('Una subasta finalizada no se puede cancelar');
    }
    if (fresh.status === 'CANCELLED') return;

    await tx.auction.update({ where: { id }, data: { status: 'CANCELLED' } });
    await tx.vehicle.updateMany({
      where: { id: current.vehicleId, status: 'IN_AUCTION' },
      data: { status: 'AVAILABLE' },
    });
  });
}

// Registro de subastas del usuario: las que creó y en las que participó.

export type AuctionHistoryRole = 'SELLER' | 'WINNER' | 'BIDDER';

export interface AuctionHistoryItemDto extends AuctionDto {
  // Rol del usuario en esta subasta. WINNER solo cuando ya terminó con él como ganador.
  myRole: AuctionHistoryRole;
  // Puja más alta del usuario; null si es el vendedor.
  myHighestBid: number | null;
  // Orden que generó el cierre con ganador, para mostrar si se pagó o venció.
  order: { id: string; status: string; paymentStatus: string; buyerId: string } | null;
}

export interface AuctionHistoryFilters {
  role?: 'seller' | 'winner' | 'bidder';
  status?: AuctionStatus;
  q?: string;
}

const ENDED: AuctionStatus[] = ['FINISHED', 'CLOSED'];

// Misma normalización que el searchText de vehículos: el texto de búsqueda llega ya en minúsculas y sin acentos.
function normalizeQuery(q: string): string {
  return q.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function historyWhere(userId: string, filters: AuctionHistoryFilters): Prisma.AuctionWhereInput {
  const asSeller: Prisma.AuctionWhereInput = { sellerId: userId };
  const asWinner: Prisma.AuctionWhereInput = { currentWinnerId: userId, status: { in: ENDED } };
  const asBidder: Prisma.AuctionWhereInput = { bids: { some: { bidderId: userId } } };
  const byRole =
    filters.role === 'seller' ? asSeller : filters.role === 'winner' ? asWinner : filters.role === 'bidder' ? asBidder : { OR: [asSeller, asBidder] };

  return {
    AND: [
      byRole,
      filters.status ? { status: filters.status } : {},
      filters.q ? { vehicle: { searchText: { contains: normalizeQuery(filters.q) } } } : {},
    ],
  };
}

export async function listMyAuctions(
  userId: string,
  filters: AuctionHistoryFilters,
  page: { skip: number; take: number },
): Promise<{ rows: AuctionHistoryItemDto[]; total: number }> {
  const where = historyWhere(userId, filters);
  const [total, rows] = await prisma.$transaction([
    prisma.auction.count({ where }),
    // El registro se lee de lo más reciente a lo más viejo, al revés del listado en vivo.
    prisma.auction.findMany({ where, include: AUCTION_INCLUDE, orderBy: { endTime: 'desc' }, skip: page.skip, take: page.take }),
  ]);
  if (rows.length === 0) return { rows: [], total };

  const auctionIds = rows.map((row) => row.id);
  const vehicleIds = rows.map((row) => row.vehicleId);
  const [myBids, orders] = await Promise.all([
    prisma.bid.groupBy({ by: ['auctionId'], where: { auctionId: { in: auctionIds }, bidderId: userId }, _max: { amount: true } }),
    prisma.order.findMany({
      where: { vehicleId: { in: vehicleIds }, origin: 'AUCTION' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, vehicleId: true, status: true, paymentStatus: true, buyerId: true },
    }),
  ]);
  const highest = new Map(myBids.map((bid) => [bid.auctionId, bid._max.amount === null ? null : Number(bid._max.amount)]));
  // Una por vehículo: la más reciente es la del cierre de esta subasta.
  const orderByVehicle = new Map<string, (typeof orders)[number]>();
  for (const order of orders) if (!orderByVehicle.has(order.vehicleId)) orderByVehicle.set(order.vehicleId, order);

  return {
    total,
    rows: rows.map((row) => {
      const myRole: AuctionHistoryRole =
        row.sellerId === userId ? 'SELLER' : row.currentWinnerId === userId && ENDED.includes(row.status) ? 'WINNER' : 'BIDDER';
      const order = orderByVehicle.get(row.vehicleId) ?? null;
      // La orden solo la ven sus partes: un postor que perdió no tiene por qué ver el pago del ganador.
      const visibleOrder = order && (myRole !== 'BIDDER' || order.buyerId === userId) ? order : null;
      return {
        ...toAuctionDto(row),
        myRole,
        myHighestBid: myRole === 'SELLER' ? null : (highest.get(row.id) ?? null),
        order: visibleOrder,
      };
    }),
  };
}

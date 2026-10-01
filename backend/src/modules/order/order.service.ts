import { randomUUID } from 'node:crypto';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { toCents, decimalString, rateString } from '../../lib/money.js';
import { env } from '../../config/env.js';
import { emitOrderPaid } from '../../socket/order-realtime.js';
import type {
  OrderOrigin,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client.js';

// Pago simulado (proyecto académico) con flujo completo; cambiar a una pasarela real es reemplazar solo `chargeSimulated`.

type Db = Prisma.TransactionClient;

export interface OrderDto {
  id: string;
  orderNumber: string;
  vehicleId: string;
  buyerId: string;
  sellerId: string;
  buyer: { id: string; fullName: string };
  seller: { id: string; fullName: string };
  vehicle: { id: string; title: string; year: number; imageUrl: string | null };
  origin: OrderOrigin;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutSessionDto {
  // Credencial del simulador. En una pasarela real sería el client_secret.
  clientSecret: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  expiresAt: string | null;
  // La app sabe que no hay pasarela detrás y confirma con /orders/:id/confirm.
  mode: 'mock';
}

export type PaymentInput =
  | { method: 'CARD'; card: { brand: string; last4: string; holderName: string } }
  | { method: 'BANK_TRANSFER'; transferReference: string };

const ORDER_INCLUDE = {
  buyer: { select: { id: true, fullName: true } },
  seller: { select: { id: true, fullName: true } },
  vehicle: {
    select: { id: true, brand: true, model: true, year: true, images: { orderBy: { position: 'asc' }, take: 1 } },
  },
} as const satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

// Tarjeta de prueba que el simulador siempre rechaza, igual que la 4000 0000 0000 0002 de las pasarelas.
const DECLINED_TEST_LAST4 = '0002';

// Half-even sobre centavos enteros: sin esto subtotal * 1.13 puede dar 5,576.9999 y el cliente vería un centavo menos.
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

// IVA en centavos enteros, ya redondeado.
export function computeTaxCents(subtotalCents: number, rate: number): number {
  return roundHalfEven(subtotalCents * rate);
}

// ORD-2026-A1B2C3: único, legible y ordenable por fecha.
function buildOrderNumber(now: Date): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `ORD-${now.getUTCFullYear()}-${suffix}`;
}

function toOrderDto(row: OrderRow): OrderDto {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    vehicleId: row.vehicleId,
    buyerId: row.buyerId,
    sellerId: row.sellerId,
    buyer: row.buyer,
    seller: row.seller,
    vehicle: {
      id: row.vehicle.id,
      title: `${row.vehicle.brand} ${row.vehicle.model}`,
      year: row.vehicle.year,
      imageUrl: row.vehicle.images[0]?.url ?? null,
    },
    origin: row.origin,
    subtotal: Number(row.subtotal),
    taxRate: Number(row.taxRate),
    taxAmount: Number(row.taxAmount),
    totalAmount: Number(row.totalAmount),
    currency: env.orders.currency,
    status: row.status,
    paymentStatus: row.paymentStatus,
    paymentMethod: row.paymentMethod,
    paymentReference: row.paymentReference,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function amounts(subtotalCents: number) {
  const taxRate = env.orders.taxRate;
  const taxCents = computeTaxCents(subtotalCents, taxRate);
  return {
    subtotal: decimalString(subtotalCents),
    taxRate: rateString(taxRate),
    taxAmount: decimalString(taxCents),
    totalAmount: decimalString(subtotalCents + taxCents),
  };
}

// El índice único parcial (una orden activa por vehículo) es la última defensa ante dos compras simultáneas.
function isActiveOrderConflict(err: unknown): boolean {
  return (err as { code?: string })?.code === 'P2002';
}

// Orden y reserva en la misma transacción; si el precio cambió desde que el cliente lo vio, 409 en vez de cobrar otra cifra.
export async function createOrder(
  buyerId: string,
  vehicleId: string,
  options: { expectedVehiclePrice?: number; chatId?: string } = {},
): Promise<OrderDto> {
  try {
    const order = await prisma.$transaction(async (tx) => {
      const [buyer, vehicle] = await Promise.all([
        tx.user.findFirst({ where: { id: buyerId, isActive: true }, select: { id: true } }),
        tx.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } }),
      ]);
      if (!buyer) throw AppError.notFound('User');
      if (!vehicle) throw AppError.notFound('Vehicle');
      if (vehicle.sellerId === buyerId) throw AppError.badRequest('No podes comprar tu propio vehiculo');
      if (vehicle.saleType === 'AUCTION') throw AppError.conflict('Este vehiculo solo se vende por subasta', { status: vehicle.status });
      if (vehicle.status !== 'AVAILABLE') {
        const message =
          vehicle.status === 'RESERVED'
            ? 'Este vehiculo ya esta reservado'
            : vehicle.status === 'IN_AUCTION'
              ? 'Este vehiculo esta en subasta'
              : 'Este vehiculo ya no esta disponible';
        throw AppError.conflict(message, { status: vehicle.status });
      }

      const subtotalCents = toCents(Number(vehicle.basePrice));
      if (options.expectedVehiclePrice !== undefined && toCents(options.expectedVehiclePrice) !== subtotalCents) {
        throw AppError.conflict('El precio del vehiculo cambio', { currentPrice: Number(vehicle.basePrice) });
      }

      const now = new Date();
      const created = await tx.order.create({
        data: {
          vehicleId: vehicle.id,
          buyerId,
          sellerId: vehicle.sellerId,
          orderNumber: buildOrderNumber(now),
          origin: 'DIRECT_SALE',
          ...amounts(subtotalCents),
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING',
          expiresAt: new Date(now.getTime() + env.orders.paymentExpiryMinutes * 60_000),
        },
        include: ORDER_INCLUDE,
      });

      // updateMany por AVAILABLE: de dos compras concurrentes, la segunda ve count 0 y revierte en vez de reservar un auto ajeno.
      const reserved = await tx.vehicle.updateMany({
        where: { id: vehicle.id, status: 'AVAILABLE' },
        data: { status: 'RESERVED' },
      });
      if (reserved.count !== 1) {
        throw AppError.conflict('El vehiculo ya fue reservado por otra compra', { status: 'RESERVED' });
      }

      // La FK vive en CHATS: la conversación es la que se ata a la orden.
      if (options.chatId) {
        const chat = await tx.chat.findFirst({
          where: { id: options.chatId, orderId: null, vehicleId: vehicle.id, OR: [{ buyerId }, { sellerId: buyerId }] },
          select: { id: true },
        });
        if (!chat) throw AppError.badRequest('La conversacion no corresponde a este vehiculo');
        await tx.chat.update({ where: { id: chat.id }, data: { orderId: created.id } });
      }

      return created;
    });
    return toOrderDto(order);
  } catch (err) {
    if (isActiveOrderConflict(err)) throw AppError.conflict('El vehiculo ya fue reservado por otra compra', { status: 'RESERVED' });
    throw err;
  }
}

// Corre dentro de la transacción del cierre para no dejar la subasta cerrada sin orden; el subtotal es la puja ganadora.
export async function createAuctionOrderTx(
  tx: Db,
  input: { vehicleId: string; sellerId: string; winnerId: string; winningBid: number },
): Promise<string> {
  const now = new Date();
  const order = await tx.order.create({
    data: {
      vehicleId: input.vehicleId,
      buyerId: input.winnerId,
      sellerId: input.sellerId,
      orderNumber: buildOrderNumber(now),
      origin: 'AUCTION',
      ...amounts(toCents(input.winningBid)),
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      expiresAt: new Date(now.getTime() + env.orders.auctionPaymentHours * 3_600_000),
    },
    select: { id: true },
  });

  // Ganador y vendedor quedan conectados para coordinar la entrega; si ya conversaban se reutiliza el hilo.
  const existing = await tx.chat.findFirst({
    where: { vehicleId: input.vehicleId, buyerId: input.winnerId, sellerId: input.sellerId },
    select: { id: true, orderId: true },
  });
  if (existing) {
    if (!existing.orderId) await tx.chat.update({ where: { id: existing.id }, data: { orderId: order.id } });
  } else {
    await tx.chat.create({
      data: { vehicleId: input.vehicleId, buyerId: input.winnerId, sellerId: input.sellerId, chatType: 'AUCTION_WIN', orderId: order.id },
    });
  }
  return order.id;
}

async function findBuyerOrder(tx: Db, requesterId: string, orderId: string) {
  const order = await tx.order.findFirst({ where: { id: orderId, buyerId: requesterId } });
  if (!order) throw AppError.notFound('Order');
  return order;
}

// Libera el vehículo; si la orden nació de una subasta, la subasta queda CLOSED: hubo ganador pero no venta.
async function releaseOrder(tx: Db, order: { id: string; vehicleId: string; origin: OrderOrigin }): Promise<void> {
  await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', paymentStatus: 'FAILED' } });
  await tx.vehicle.updateMany({ where: { id: order.vehicleId, status: 'RESERVED' }, data: { status: 'AVAILABLE' } });
  if (order.origin === 'AUCTION') {
    await tx.auction.updateMany({ where: { vehicleId: order.vehicleId, status: 'FINISHED' }, data: { status: 'CLOSED' } });
  }
}

function assertPayable(order: { status: OrderStatus; expiresAt: Date | null }): void {
  if (order.status !== 'PENDING_PAYMENT') {
    throw AppError.conflict('Esta orden ya no esta pendiente de pago', { status: order.status });
  }
  if (order.expiresAt && order.expiresAt.getTime() <= Date.now()) {
    throw new AppError(409, 'ORDER_EXPIRED', 'La reserva vencio. Volve a la ficha para intentar la compra de nuevo.');
  }
}

// Abre la sesión de pago simulada: `confirm` no se acepta sin haber pasado por acá.
export async function createCheckoutSession(requesterId: string, orderId: string): Promise<CheckoutSessionDto> {
  const order = await prisma.order.findFirst({ where: { id: orderId, buyerId: requesterId } });
  if (!order) throw AppError.notFound('Order');
  assertPayable(order);

  const sessionId = order.gatewaySessionId ?? `mock_${randomUUID().replace(/-/g, '')}`;
  await prisma.order.update({ where: { id: order.id }, data: { gatewaySessionId: sessionId } });

  return {
    clientSecret: `${sessionId}_secret`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: Number(order.totalAmount),
    currency: env.orders.currency,
    expiresAt: order.expiresAt ? order.expiresAt.toISOString() : null,
    mode: 'mock',
  };
}

// La "pasarela": aprueba todo salvo la tarjeta de prueba de rechazo. Es el único punto a cambiar por una real.
function chargeSimulated(payment: PaymentInput): { approved: boolean; reference: string } {
  if (payment.method === 'CARD') {
    return {
      approved: payment.card.last4 !== DECLINED_TEST_LAST4,
      reference: `${payment.card.brand.toUpperCase()} •••• ${payment.card.last4}`,
    };
  }
  return { approved: true, reference: `Transferencia ${payment.transferReference}` };
}

// Rechazado deja la orden pendiente con paymentStatus FAILED para reintentar; confirmar una ya pagada no cobra de nuevo.
export async function confirmPayment(requesterId: string, orderId: string, payment: PaymentInput): Promise<OrderDto> {
  let alreadyPaid = false;
  let declined = false;

  const updated = await prisma.$transaction(async (tx) => {
    const order = await findBuyerOrder(tx, requesterId, orderId);
    if (order.status === 'PAID') {
      alreadyPaid = true;
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE });
    }
    assertPayable(order);
    if (!order.gatewaySessionId) {
      throw AppError.conflict('Primero hay que abrir la sesion de pago', { status: order.status });
    }

    const charge = chargeSimulated(payment);
    if (!charge.approved) {
      declined = true;
      return tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'FAILED', paymentMethod: payment.method, paymentReference: charge.reference },
        include: ORDER_INCLUDE,
      });
    }

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paymentStatus: 'COMPLETED',
        paymentMethod: payment.method,
        paymentReference: charge.reference,
        completedAt: new Date(),
        paymentGatewayId: `mock_pay_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        vehicle: { update: { status: 'SOLD' } },
      },
      include: ORDER_INCLUDE,
    });
  });

  // 402 después del commit: el intento rechazado queda registrado en la orden aunque la respuesta sea error.
  if (declined) {
    throw new AppError(402, 'PAYMENT_DECLINED', 'El pago fue rechazado. Proba con otra tarjeta o con transferencia.');
  }

  const dto = toOrderDto(updated);
  if (!alreadyPaid) {
    emitOrderPaid({
      orderId: dto.id,
      orderNumber: dto.orderNumber,
      vehicleId: dto.vehicleId,
      buyerId: dto.buyerId,
      sellerId: dto.sellerId,
      status: dto.status,
      paymentStatus: dto.paymentStatus,
      totalAmount: dto.totalAmount,
      currency: dto.currency,
      completedAt: dto.completedAt,
    });
  }
  return dto;
}

// El comprador desiste: la orden se cancela y el vehículo vuelve al catálogo.
export async function cancelOrder(requesterId: string, orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await findBuyerOrder(tx, requesterId, orderId);
    if (order.status !== 'PENDING_PAYMENT') {
      throw AppError.conflict('Solo se pueden cancelar ordenes pendientes de pago', { status: order.status });
    }
    await releaseOrder(tx, order);
  });
}

export async function listMyOrders(requesterId: string, options: { role?: 'buyer' | 'seller' } = {}): Promise<OrderDto[]> {
  const where =
    options.role === 'seller'
      ? { sellerId: requesterId }
      : options.role === 'buyer'
        ? { buyerId: requesterId }
        : { OR: [{ buyerId: requesterId }, { sellerId: requesterId }] };
  const rows = await prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, include: ORDER_INCLUDE });
  return rows.map(toOrderDto);
}

export async function getOrder(requesterId: string, orderId: string): Promise<OrderDto> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, OR: [{ buyerId: requesterId }, { sellerId: requesterId }] },
    include: ORDER_INCLUDE,
  });
  if (!order) throw AppError.notFound('Order');
  return toOrderDto(order);
}

// Libera las órdenes vencidas. Sin esto un vehículo queda RESERVED para siempre si nadie paga.
export async function releaseExpiredOrders(): Promise<number> {
  const expired = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', expiresAt: { lt: new Date() } },
    select: { id: true, vehicleId: true, origin: true },
  });
  for (const order of expired) {
    // Una por transacción: una orden que falla no debe frenar la liberación de las demás.
    await prisma.$transaction((tx) => releaseOrder(tx, order)).catch((err: unknown) => {
      console.error(`[order-expiry] no se pudo liberar la orden ${order.id}:`, err);
    });
  }
  return expired.length;
}

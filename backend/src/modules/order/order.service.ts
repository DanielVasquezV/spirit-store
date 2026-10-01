import { randomUUID } from 'node:crypto';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { toCents, decimalString, rateString } from '../../lib/money.js';
import { env } from '../../config/env.js';
import { emitOrderPaid } from '../../socket/order-realtime.js';
import type { OrderStatus, PaymentStatus, Prisma } from '../../generated/prisma/client.js';

// Ordenes de venta directa.
//
// El checkout es SIMULADO: no hay gateway de pagos detras. `checkout-session`
// devuelve credenciales `mock_` y `confirm` marca la orden como pagada. La
// forma de la API es la de un gateway real (subtotal / tax / total los calcula
// el servidor) para que cambiar a Stripe sea reemplazar el servicio de pagos y
// no el contrato.

export interface OrderDto {
  id: string;
  orderNumber: string;
  vehicleId: string;
  buyerId: string;
  sellerId: string;
  buyer: { id: string; fullName: string };
  seller: { id: string; fullName: string };
  vehicle: { id: string; title: string; imageUrl: string | null };
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutSessionDto {
  /** Credencial del simulador. En un gateway real seria el client_secret. */
  clientSecret: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  /** La app sabe que no hay gateway detras y puede ofrecer pago simulado. */
  mode: 'mock';
}

const ORDER_INCLUDE = {
  buyer: { select: { id: true, fullName: true } },
  seller: { select: { id: true, fullName: true } },
  vehicle: {
    select: { id: true, brand: true, model: true, images: { orderBy: { position: 'asc' }, take: 1 } },
  },
} as const satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

/**
 * Redondeo half-even a 2 decimales sobre centavos enteros. Es el mismo criterio
 * que exige el contrato: sin el, `total = subtotal * 1.13` puede dar 5,576.99999
 * y el cliente mostraria un centavo menos que el server.
 */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  // Exactamente .5: half-even reparte al par mas cercano.
  return floor % 2 === 0 ? floor : floor + 1;
}

/** IVA en centavos enteros. Devuelve el tax en centavos ya redondeado. */
export function computeTaxCents(subtotalCents: number, rate: number): number {
  return roundHalfEven(subtotalCents * rate);
}

/** ORD-2026-A1B2C3: unico, legible y ordenable por fecha. */
function buildOrderNumber(now: Date): string {
  const year = now.getUTCFullYear();
  const suffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `ORD-${year}-${suffix}`;
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
      imageUrl: row.vehicle.images[0]?.url ?? null,
    },
    subtotal: Number(row.subtotal),
    taxRate: Number(row.taxRate),
    taxAmount: Number(row.taxAmount),
    totalAmount: Number(row.totalAmount),
    currency: env.orders.currency,
    status: row.status,
    paymentStatus: row.paymentStatus,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Crea la orden y reserva el vehiculo en la misma transaccion: si el INSERT
 * pasara y la reserva fallara, el vehiculo quedaria AVAILABLE con una orden viva
 * y otro comprador podria llevarselo.
 *
 * `expectedVehiclePrice` es el precio que el cliente vio. Si el dueno lo cambio
 * entre ver la ficha y pagar, se rechaza el 409 en vez de cobrar otra cifra: el
 * cliente tiene que volver a confirmar viendo el precio nuevo.
 */
export async function createOrder(
  buyerId: string,
  vehicleId: string,
  options: { expectedVehiclePrice?: number; chatId?: string } = {},
): Promise<OrderDto> {
  const taxRate = env.orders.taxRate;

  const order = await prisma.$transaction(async (tx) => {
    const [buyer, vehicle] = await Promise.all([
      tx.user.findFirst({ where: { id: buyerId, isActive: true }, select: { id: true } }),
      tx.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } }),
    ]);
    if (!buyer) throw AppError.notFound('User');
    if (!vehicle) throw AppError.notFound('Vehicle');
    if (vehicle.sellerId === buyerId) {
      throw AppError.badRequest('No podes comprar tu propio vehiculo');
    }
    if (vehicle.status !== 'AVAILABLE') {
      // El mensaje distingue el caso que el usuario puede entender (otro ya lo
      // tiene reservado) del que no (quedo en subasta).
      const message =
        vehicle.status === 'RESERVED'
          ? 'Este vehiculo ya esta reservado'
          : vehicle.status === 'IN_AUCTION'
            ? 'Este vehiculo esta en subasta'
            : 'Este vehiculo ya no esta disponible';
      throw AppError.conflict(message, { status: vehicle.status });
    }

    const subtotalCents = toCents(Number(vehicle.basePrice));
    if (
      options.expectedVehiclePrice !== undefined &&
      toCents(options.expectedVehiclePrice) !== subtotalCents
    ) {
      throw AppError.conflict('El precio del vehiculo cambio', {
        currentPrice: Number(vehicle.basePrice),
      });
    }
    const taxCents = computeTaxCents(subtotalCents, taxRate);

    const created = await tx.order.create({
      data: {
        vehicleId: vehicle.id,
        buyerId,
        sellerId: vehicle.sellerId,
        orderNumber: buildOrderNumber(new Date()),
        subtotal: decimalString(subtotalCents),
        taxRate: rateString(taxRate),
        taxAmount: decimalString(taxCents),
        totalAmount: decimalString(subtotalCents + taxCents),
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        vehicle: { update: { status: 'RESERVED' } },
      },
      include: ORDER_INCLUDE,
    });

    // La FK vive en CHATS, no al reves: la conversacion es la que se ata a la
    // orden. Sin esto un chat ajeno quedaria enlazado a una compra ajena.
    if (options.chatId) {
      const chat = await tx.chat.findFirst({
        where: {
          id: options.chatId,
          orderId: null,
          // Un chat sin vehiculo es una pregunta general: no puede originar una
          // compra de este vehiculo concreto.
          vehicleId: vehicle.id,
          OR: [{ buyerId }, { sellerId: buyerId }],
        },
        select: { id: true },
      });
      if (!chat) throw AppError.badRequest('La conversacion no corresponde a este vehiculo');
      await tx.chat.update({ where: { id: chat.id }, data: { orderId: created.id } });
    }

    return created;
  });

  return toOrderDto(order);
}

/**
 * Sesion de pago simulada. En un gateway real esto crearia una PaymentIntent;
 * aca solo se marca la orden como teniendo una sesion viva para que `confirm`
 * sea idempotente y no se pueda confirmar sin haber pasado por aca.
 */
export async function createCheckoutSession(
  requesterId: string,
  orderId: string,
): Promise<CheckoutSessionDto> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, buyerId: requesterId },
    include: ORDER_INCLUDE,
  });
  if (!order) throw AppError.notFound('Order');
  if (order.status !== 'PENDING_PAYMENT') {
    throw AppError.conflict('Esta orden ya no esta pendiente de pago', { status: order.status });
  }

  const sessionId = order.gatewaySessionId ?? `mock_${randomUUID().replace(/-/g, '')}`;

  await prisma.order.update({ where: { id: order.id }, data: { gatewaySessionId: sessionId } });

  return {
    clientSecret: `${sessionId}_secret`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: Number(order.totalAmount),
    currency: env.orders.currency,
    mode: 'mock',
  };
}

/**
 * Confirmacion del pago simulado: marca la orden pagada, el vehiculo vendido y
 * avisa por socket. Es idempotente: confirmar dos veces no cambia el resultado.
 */
export async function confirmPayment(requesterId: string, orderId: string): Promise<OrderDto> {
  // El flag evita el doble aviso: el camino idempotente devuelve temprano y
  // es el unico camino que no emite, o el cliente recibe dos order:paid.
  let alreadyPaid = false;

  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, buyerId: requesterId } });
    if (!order) throw AppError.notFound('Order');
    if (order.status === 'PAID') {
      // Idempotente a proposito: el cliente puede reintentar un confirm sin miedo.
      alreadyPaid = true;
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE });
    }
    if (order.status !== 'PENDING_PAYMENT') {
      throw AppError.conflict('Esta orden ya no esta pendiente de pago', { status: order.status });
    }

    const paid = await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paymentStatus: 'COMPLETED',
        completedAt: new Date(),
        paymentGatewayId: `mock_pay_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        vehicle: { update: { status: 'SOLD' } },
      },
      include: ORDER_INCLUDE,
    });

    return paid;
  });

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

/** Cancela la orden y libera el vehiculo. La usa el job de expiracion y el usuario. */
export async function cancelOrder(requesterId: string, orderId: string): Promise<OrderDto> {
  const cancelled = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, buyerId: requesterId } });
    if (!order) throw AppError.notFound('Order');
    if (order.status !== 'PENDING_PAYMENT') {
      throw AppError.conflict('Solo se pueden cancelar ordenes pendientes de pago', { status: order.status });
    }

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
        // El vehiculo vuelve al catalogo: sin esto queda reservado para siempre.
        vehicle: { update: { status: 'AVAILABLE' } },
      },
      include: ORDER_INCLUDE,
    });
  });

  return toOrderDto(cancelled);
}

export async function listMyOrders(
  requesterId: string,
  options: { role?: 'buyer' | 'seller' } = {},
): Promise<OrderDto[]> {
  const where =
    options.role === 'seller' ? { sellerId: requesterId } : options.role === 'buyer' ? { buyerId: requesterId } : {
      OR: [{ buyerId: requesterId }, { sellerId: requesterId }],
    };

  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: ORDER_INCLUDE,
  });

  return rows.map(toOrderDto);
}

export async function getOrder(requesterId: string, orderId: string): Promise<OrderDto> {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      OR: [{ buyerId: requesterId }, { sellerId: requesterId }],
    },
    include: ORDER_INCLUDE,
  });
  if (!order) throw AppError.notFound('Order');
  return toOrderDto(order);
}

/**
 * Libera las ordenes que nadie pago. Sin esto un vehiculo queda RESERVED para
 * siempre cuando el cliente abandona el checkout a mitad de camino.
 */
export async function releaseExpiredOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - env.orders.paymentExpiryMinutes * 60_000);
  const expired = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } },
    select: { id: true },
  });
  if (expired.length === 0) return 0;

  await prisma.$transaction(
    expired.map((order) =>
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'FAILED',
          vehicle: { update: { status: 'AVAILABLE' } },
        },
      }),
    ),
  );

  return expired.length;
}

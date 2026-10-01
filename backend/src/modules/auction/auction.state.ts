import { prisma } from '../../lib/prisma.js';
import { toCents } from '../../lib/money.js';
import { emitAuctionClosed, emitAuctionStarted } from '../../socket/realtime.js';
import { createAuctionOrderTx } from '../order/order.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Todo lo que hace falta para que una subasta sea consistente bajo concurrencia
 * y para que su ciclo de vida avance solo.
 *
 * Vive aparte de `auction.service.ts` a proposito: tanto el servicio de pujas
 * como el de subastas necesitan bloquear la fila, y si el helper estuviera en
 * el servicio los dos se importarian mutuamente.
 */

export type Db = Prisma.TransactionClient;

/** Puja minima en centavos: el precio de salida si nadie pujo, o la puja vigente
 *  mas el incremento. Comparar esto adentro de la transaccion y no en el SQL
 *  permite que el 409 devuelva el numero real que el cliente tiene que cumplir. */
export function minimumNextBid(
  currentBid: Prisma.Decimal | number | null,
  startingPrice: Prisma.Decimal | number,
  minBidIncrement: Prisma.Decimal | number,
): number {
  if (currentBid === null) return toCents(Number(startingPrice));
  return toCents(Number(currentBid)) + toCents(Number(minBidIncrement));
}

/**
 * `SELECT ... FOR UPDATE` sobre la fila de la subasta: cualquier otra puja sobre
 * la misma subasta queda esperando a que esta termine.
 *
 * Es indispensable, y no un extra. Dos pujas simultaneas sin bloqueo leen la
 * misma `currentBid`, las dos pasan la validacion del minimo y las dos escriben
 * `currentBid` con el mismo valor: el primero que grabo se pierde, el contador
 * miente y el auto que quedo como ganador puede no ser el que mas ofrecio.
 *
 * Se bloquea la fila de `auctions` y no la de `bids` porque es la que todos los
 * postores tocan siempre: serializa a todos contra un solo recurso.
 */
export async function lockAuctionRow(tx: Db, auctionId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM auctions WHERE id = ${auctionId}::uuid FOR UPDATE
  `;
  return rows.length > 0;
}

export interface AuctionClosure {
  auctionId: string;
  vehicleId: string;
  status: 'FINISHED';
  /** Null cuando la subasta termino sin pujas: entonces el vehiculo vuelve al
   *  catalogo en vez de quedarse vendido. */
  winnerId: string | null;
  currentBid: number | null;
  /** Orden pendiente de pago del ganador; null si nadie pujó. */
  orderId: string | null;
}

/**
 * Cierra la subasta y deja el vehiculo coherente con el resultado.
 *
 * Una subasta terminada sin pujas devuelve el vehiculo a `AVAILABLE` en vez de
 * dejarlo en `IN_AUCTION`: no hay ganador, entonces no hay venta, y un vehiculo
 * que nadie puede comprar ni pujar queda colgado en el catalogo.
 *
 * Es idempotente: si ya no esta `ACTIVE` devuelve null y no toca nada, asi el
 * timer y una puja que llega justo en el vencimiento pueden competir sin que
 * cierre dos veces.
 */
export async function finalizeAuction(tx: Db, auctionId: string): Promise<AuctionClosure | null> {
  // El cierre decide el destino del vehiculo a partir de `currentWinnerId`, asi
  // que esa lectura tiene que ser fresca y estar serializada contra las pujas.
  // Sin este lock el timer puede leer `winner = null`, dejar entrar una puja y
  // despues mandar a `AVAILABLE` un vehiculo que ya tiene ganador: el vehiculo
  // queda a la venta en el catalogo estando la subasta ya cerrada con comprador.
  // Re-lquear es gratis cuando el que llama ya lo tiene tomado (misma
  // transaccion, la fila ya es suya) y obligatoire cuando entra el timer.
  await lockAuctionRow(tx, auctionId);

  const auction = await tx.auction.findUnique({
    where: { id: auctionId },
    select: { id: true, vehicleId: true, sellerId: true, status: true, currentWinnerId: true, currentBid: true },
  });
  if (!auction || auction.status !== 'ACTIVE') return null;

  const winnerId = auction.currentWinnerId;
  await tx.auction.update({ where: { id: auctionId }, data: { status: 'FINISHED' } });
  // Con ganador el vehículo queda RESERVED hasta que pague su orden; sin pujas vuelve al catálogo.
  // El `status: 'IN_AUCTION'` del where evita pisar un vehiculo que otro flujo ya haya movido.
  await tx.vehicle.updateMany({
    where: { id: auction.vehicleId, status: 'IN_AUCTION' },
    data: { status: winnerId ? 'RESERVED' : 'AVAILABLE' },
  });

  const orderId =
    winnerId && auction.currentBid !== null
      ? await createAuctionOrderTx(tx, {
          vehicleId: auction.vehicleId,
          sellerId: auction.sellerId,
          winnerId,
          winningBid: Number(auction.currentBid),
        })
      : null;

  return {
    auctionId: auction.id,
    vehicleId: auction.vehicleId,
    status: 'FINISHED',
    winnerId,
    currentBid: auction.currentBid === null ? null : Number(auction.currentBid),
    orderId,
  };
}

/** Cierra una subasta vencida y avisa a la sala. Se usa desde el timer y desde
 *  el propio alta de pujas, para que una puja que llega despues del `endTime`
 *  no encuentre la subasta todavia `ACTIVE`. */
export async function finalizeAndAnnounce(auctionId: string): Promise<AuctionClosure | null> {
  const closure = await prisma.$transaction(async (tx) => finalizeAuction(tx, auctionId));
  // Fuera de la transaccion: emitir antes del commit haria que un cliente viera
  // una subasta cerrada que todavia puede fallar y volver a `ACTIVE`.
  if (closure) emitAuctionClosed(closure);
  return closure;
}

export interface LifecycleResult {
  activated: number;
  closed: AuctionClosure[];
}

/**
 * Un tick del ciclo de vida: activa las que ya arrancaron y cierra las que ya
 * vencieron.
 *
 * Sin esto el estado de una subasta solo avanzaria cuando alguien la mirara, y
 * como nadie mira una subasta que ya termino, se quedaria `ACTIVE` para siempre
 * sin ganador.
 */
export async function runAuctionLifecycle(now: Date = new Date()): Promise<LifecycleResult> {
  const pending = await prisma.auction.findMany({
    where: { status: 'PENDING', startTime: { lte: now } },
    select: { id: true, startingPrice: true, minBidIncrement: true },
  });

  let activated = 0;
  if (pending.length > 0) {
    const result = await prisma.auction.updateMany({
      where: { id: { in: pending.map((a) => a.id) }, status: 'PENDING' },
      data: { status: 'ACTIVE' },
    });
    activated = result.count;
    // Puede incluir una que otra instancia activo primero: el evento es
    // idempotente para el cliente, que solo tiene que pintar "en curso".
    for (const auction of pending) {
      emitAuctionStarted({
        auctionId: auction.id,
        startingPrice: Number(auction.startingPrice),
        minBidIncrement: Number(auction.minBidIncrement),
      });
    }
  }

  const due = await prisma.auction.findMany({
    where: { status: 'ACTIVE', endTime: { lte: now } },
    select: { id: true },
  });

  const closed: AuctionClosure[] = [];
  for (const auction of due) {
    // Una por transaccion y en serie: un cierre que falla no debe impedir que
    // las demas subastas vencidas se cierren.
    try {
      const closure = await finalizeAndAnnounce(auction.id);
      if (closure) closed.push(closure);
    } catch (err) {
      console.error(`[auction-lifecycle] no se pudo cerrar la subasta ${auction.id}:`, err);
    }
  }

  return { activated, closed };
}

const DEFAULT_INTERVAL_MS = 15_000;

/**
 * Timer del ciclo de vida. `unref` para que no sea el reason de exit del
 * proceso, y una corrida al arrancar para que un servidor que estuvo caido no
 * espere al primer tick.
 */
export function startAuctionLifecycleScheduler(intervalMs = DEFAULT_INTERVAL_MS): { stop: () => void } {
  const tick = (): void => {
    void runAuctionLifecycle().catch((err: unknown) => {
      console.error('[auction-lifecycle] fallo el tick:', err);
    });
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();

  return { stop: () => clearInterval(timer) };
}
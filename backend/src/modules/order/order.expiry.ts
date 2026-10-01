import { releaseExpiredOrders } from './order.service.js';

// Cada minuto alcanza: la expiracion es de 30 min por defecto, asi que el
// vehiculo puede quedar RESERVED un minuto extra, que es invisible para el
// usuario y mucho mas barato que un tick agresivo sobre la tabla.
const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Timer de expiracion de ordenes. Mismo criterio que el ciclo de vida de
 * subastas: `unref` para no ser el reason of exit del proceso, y una corrida al
 * arrancar para recuperar lo que se perdio con el servidor caido.
 */
export function startOrderExpiryScheduler(intervalMs = DEFAULT_INTERVAL_MS): { stop: () => void } {
  const tick = (): void => {
    void releaseExpiredOrders().catch((err: unknown) => {
      console.error('[order-expiry] fallo el tick:', err);
    });
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();

  return { stop: () => clearInterval(timer) };
}
// Eventos de ordenes.
//
// Mismo patron que `chat-realtime.ts`: el servicio empuja aca sin conocer la
// instancia de Socket.IO y el sink es no-op cuando el socket no esta levantado,
// para que un test del servicio no tenga que montar sockets.

export interface OrderPaidEvent {
  orderId: string;
  orderNumber: string;
  vehicleId: string;
  /** Ambos participan: el comprador ve el pago y el vendedor la venta. */
  buyerId: string;
  sellerId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  currency: string;
  completedAt: string | null;
}

export interface OrderRealtimeSink {
  orderPaid: (event: OrderPaidEvent) => void;
}

const noop: OrderRealtimeSink = {
  orderPaid: () => undefined,
};

let sink: OrderRealtimeSink = noop;

export function setOrderRealtimeSink(next: OrderRealtimeSink | null): void {
  sink = next ?? noop;
}

// El aviso sale despues del commit: emitirlo dentro de la transaccion perderia
// el evento si el commit fallara.
export function emitOrderPaid(event: OrderPaidEvent): void {
  sink.orderPaid(event);
}
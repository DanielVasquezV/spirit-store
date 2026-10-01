import type { ServerOptions } from 'socket.io';

import { env } from './env.js';

// Aparte de la config de Express: los sockets tienen otro ciclo de vida
// (reconexión, heartbeats, ping/pong) y mezclar los timeouts haría que tocar uno
// obligara a revisar el otro.
export const SOCKET_IO_OPTIONS: Partial<ServerOptions> = {
  path: '/socket.io',

  // polling primero porque es el único que sobrevive a proxies que cortan
  // WebSockets; Socket.io promueve a websocket apenas el handshake responde.
  transports: ['websocket', 'polling'],

  cors: {
    origin: env.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },

  // El handshake es la única petición que pasa por HTTP en toda la vida de la
  // conexión, así que un timeout corto descarta clientes muertos.
  connectTimeout: 10_000,

  // Recupera el estado en el servidor tras una reconexión. 2 min alcanza para un
  // cambio de red en móvil sin dejar salas huérfanas.
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60_000,
    skipMiddlewares: true,
  },

  // 20s sin pong => desconexión. Más corto que el default de 45s porque una sala
  // de subasta con datos rancios es peor que una reconexión.
  pingInterval: 20_000,
  pingTimeout: 20_000,

  // ~1MB por mensaje. Una puja pesa bytes; las imágenes van por HTTP firmado.
  maxHttpBufferSize: 1e6,
};

// Centralizados para que un typo en un emit no cree un canal fantasma que el
// cliente espera y nunca llega.
export const SOCKET_EVENTS = {
  connection: {
    ready: 'connection:ready',
    error: 'connection:error',
  },
  auction: {
    join: 'auction:join',
    leave: 'auction:leave',
    started: 'auction:started',
    bidPlaced: 'auction:bid-placed',
    outbid: 'auction:outbid',
    closed: 'auction:closed',
  },
  chat: {
    join: 'chat:join',
    leave: 'chat:leave',
    message: 'chat:message',
    read: 'chat:read',
  },
  diagnostic: {
    // Sin `stream`: la llamada a Gemini no se hace en streaming, asi que el
    // veredicto llega entero en `done`. Declarar un evento que nadie emite deja
    // un canal fantasma esperando en el cliente.
    done: 'diagnostic:done',
  },
  order: {
    paid: 'order:paid',
  },
} as const;

// El usuario entra a la suya al conectar; las de recurso, bajo demanda, para no
// emitir eventos a salas que nadie escucha.
export const SOCKET_ROOMS = {
  user: (userId: string): string => `user:${userId}`,
  auction: (auctionId: string): string => `auction:${auctionId}`,
  chat: (chatId: string): string => `chat:${chatId}`,
} as const;

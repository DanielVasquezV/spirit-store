import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';

import { SOCKET_EVENTS, SOCKET_IO_OPTIONS, SOCKET_ROOMS } from '../config/socket.js';
import { ERROR_CODES } from '../lib/api-response.js';
import { AppError } from '../middleware/error-handler.js';
import { verifyAccessToken } from '../lib/jwt.js';
import type { AuthTokenPayload } from '../lib/jwt.js';

// Lo que deja authorizeHandshake. Va en socket.data porque sobrevive a los
// handlers y lo leen los listeners de sala.
interface SocketData {
  auth: AuthTokenPayload;
}

export interface SocketServer {
  io: Server;
  close: () => Promise<void>;
}

function readHandshakeToken(socket: Socket): string | null {
  // El cliente Expo no puede fijar cabeceras en el WebSocket nativo, así que el
  // token viaja en auth o en query.
  const fromAuth = socket.handshake.auth?.['token'];
  if (typeof fromAuth === 'string' && fromAuth) return fromAuth;
  const fromQuery = socket.handshake.query['token'];
  return typeof fromQuery === 'string' && fromQuery ? fromQuery : null;
}

// Rechaza el handshake sin JWT válido antes de que el socket entre en el ciclo
// de eventos, así un cliente no autenticado nunca llega a unirse a una sala.
function authorizeHandshake(socket: Socket, next: (err?: Error) => void): void {
  const token = readHandshakeToken(socket);
  if (!token) {
    next(
      new AppError(
        401,
        ERROR_CODES.UNAUTHENTICATED,
        'Missing token: pass it as handshake auth.token',
      ),
    );
    return;
  }
  try {
    (socket.data as SocketData).auth = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError(401, ERROR_CODES.UNAUTHENTICATED, 'Invalid or expired token'));
  }
}

// El token puede caducar con el socket abierto, así que cada 10 min se pide
// reconexión para que el cliente lo renueve.
const MAX_SOCKET_LIFETIME_MS = 10 * 60_000;

const emitError = (socket: Socket, code: string, message: string): void => {
  socket.emit(SOCKET_EVENTS.connection.error, { code, message });
};

// Fuera de app.ts a propósito: los sockets no son middlewares, y acoplarlos a
// la config de Express impediría testear la app sin levantarlos.
export function initSocketServer(httpServer: HttpServer): SocketServer {
  const io = new Server(httpServer, SOCKET_IO_OPTIONS);

  io.use(authorizeHandshake);

  io.on('connection', (socket) => {
    const { auth } = socket.data as SocketData;

    // Notificaciones dirigidas a este usuario, se entre o no a alguna sala de
    // recurso.
    void socket.join(SOCKET_ROOMS.user(auth.sub));

    socket.emit(SOCKET_EVENTS.connection.ready, { userId: auth.sub, role: auth.role });

    const forceReconnect = setTimeout(() => {
      emitError(socket, ERROR_CODES.UNAUTHENTICATED, 'Session expired, please reconnect');
      socket.disconnect(true);
    }, MAX_SOCKET_LIFETIME_MS);
    // Que el timer no mantenga vivo el proceso.
    forceReconnect.unref();

    // Salas de recurso. La pertenencia (que el chat sea del usuario, por ejemplo)
    // se valida contra la base de datos cuando existan esos servicios; acá solo
    // se gestiona la suscripción.
    socket.on(SOCKET_EVENTS.auction.join, (payload: { auctionId?: unknown } = {}) => {
      if (typeof payload.auctionId !== 'string') {
        emitError(socket, ERROR_CODES.VALIDATION, 'auctionId is required');
        return;
      }
      void socket.join(SOCKET_ROOMS.auction(payload.auctionId));
      socket.emit(SOCKET_EVENTS.auction.join, { auctionId: payload.auctionId });
    });

    socket.on(SOCKET_EVENTS.auction.leave, (payload: { auctionId?: unknown } = {}) => {
      if (typeof payload.auctionId !== 'string') return;
      void socket.leave(SOCKET_ROOMS.auction(payload.auctionId));
    });

    socket.on(SOCKET_EVENTS.chat.join, (payload: { chatId?: unknown } = {}) => {
      if (typeof payload.chatId !== 'string') return;
      void socket.join(SOCKET_ROOMS.chat(payload.chatId));
    });

    socket.on(SOCKET_EVENTS.chat.leave, (payload: { chatId?: unknown } = {}) => {
      if (typeof payload.chatId !== 'string') return;
      void socket.leave(SOCKET_ROOMS.chat(payload.chatId));
    });

    socket.on('disconnect', () => {
      clearTimeout(forceReconnect);
    });
  });

  return {
    io,
    close: () =>
      new Promise<void>((resolve) => {
        // Sin cerrar las conexiones activas el proceso no termina.
        io.close(() => resolve());
      }),
  };
}

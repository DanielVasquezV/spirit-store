import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';

import { SOCKET_EVENTS, SOCKET_IO_OPTIONS, SOCKET_ROOMS } from '../config/socket.js';
import { ERROR_CODES } from '../lib/api-response.js';
import { AppError } from '../middleware/error-handler.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { isUuid } from '../lib/validate.js';
import { prisma } from '../lib/prisma.js';
import { setAuctionRealtimeSink } from './realtime.js';
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

  // Los servicios de pujas y de subastas empujan eventos aca sin conocer esta
  // instancia. Se registra antes que nada para que una puja que llegue durante
  // el arranque no se quede sin emitir.
  setAuctionRealtimeSink({
    bidPlaced: (event) => {
      // A la sala de la subasta: todos los que la están mirando.
      io.to(SOCKET_ROOMS.auction(event.auctionId)).emit(SOCKET_EVENTS.auction.bidPlaced, event);
    },
    outbid: (event) => {
      // A la sala personal del desplazado, para que se entere aunque tenga la
      // pantalla de la subasta en background.
      io.to(SOCKET_ROOMS.user(event.previousWinnerId)).emit(SOCKET_EVENTS.auction.outbid, event);
    },
    started: (event) => {
      io.to(SOCKET_ROOMS.auction(event.auctionId)).emit(SOCKET_EVENTS.auction.started, event);
    },
    closed: (event) => {
      io.to(SOCKET_ROOMS.auction(event.auctionId)).emit(SOCKET_EVENTS.auction.closed, event);
    },
  });

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

    // Salas de recurso. La pertenencia se valida contra la base: entrar a la sala de
    // una subasta es recibir todas las pujas de esa subasta, y sin este chequeo
    // cualquier cuenta autenticada se suscribiria a las de todos los demas.
    socket.on(SOCKET_EVENTS.auction.join, (payload: { auctionId?: unknown } = {}) => {
      const auctionId = payload.auctionId;
      if (typeof auctionId !== 'string' || !isUuid(auctionId)) {
        emitError(socket, ERROR_CODES.VALIDATION, 'auctionId is required');
        return;
      }
      // El mismo criterio de lectura que GET /auctions/:id: no se entra a la sala
      // de una subasta borrada.
      void prisma.auction
        .findFirst({ where: { id: auctionId, vehicle: { deletedAt: null } }, select: { id: true } })
        .then((auction) => {
          if (!auction) {
            emitError(socket, ERROR_CODES.NOT_FOUND, 'Auction not found');
            return;
          }
          void socket.join(SOCKET_ROOMS.auction(auctionId));
          socket.emit(SOCKET_EVENTS.auction.join, { auctionId });
        })
        .catch(() => emitError(socket, ERROR_CODES.INTERNAL, 'No se pudo entrar a la subasta'));
    });

    socket.on(SOCKET_EVENTS.auction.leave, (payload: { auctionId?: unknown } = {}) => {
      if (typeof payload.auctionId !== 'string') return;
      void socket.leave(SOCKET_ROOMS.auction(payload.auctionId));
    });

    // El chat todavia no tiene servicio ni endpoints, asi que no hay nada que
    // autorizar: se deja la suscripcion sin validar a proposito para no fingir un
    // control que no existe. Cuando exista el modulo de chat, aca va el chequeo de
    // que el chat sea del usuario.
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
        // Desenganchar el sink antes de cerrar: si el servidor HTTP sigue vivo
        // un instante mas, una puja no debe colgarse en una instancia muerta.
        setAuctionRealtimeSink(null);
        // Sin cerrar las conexiones activas el proceso no termina.
        io.close(() => resolve());
      }),
  };
}

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
import { setRealtimeSink } from './chat-realtime.js';
import { setOrderRealtimeSink } from './order-realtime.js';
import * as chatService from '../modules/chat/chat.service.js';
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

  // Los servicios de chat y de diagnostico empujan aca. Se registra junto al
  // de pujas y antes del handshake, por el mismo motivo: un mensaje que llegue
  // durante el arranque no debe quedarse sin emitir.
  setRealtimeSink({
    chatMessage: (event) => {
      // Sala del chat + sala personal del destinatario: nadie entra a la del chat hasta abrir el hilo,
      // y sin la personal el inbox y el badge no se enteran. Socket.IO no duplica si está en ambas.
      io.to([SOCKET_ROOMS.chat(event.chatId), SOCKET_ROOMS.user(event.recipientId)]).emit(SOCKET_EVENTS.chat.message, event);
    },
    chatMessagesRead: (event) => {
      io.to(SOCKET_ROOMS.chat(event.chatId)).emit(SOCKET_EVENTS.chat.read, event);
    },
    diagnosticDone: (event) => {
      // A la sala personal de quien lo pidio: el socket se une a la suya al
      // conectar, asi que no hace falta una sala por diagnostico. El
      // `diagnosticId` viaja en el payload para desambiguar.
      io.to(SOCKET_ROOMS.user(event.userId)).emit(SOCKET_EVENTS.diagnostic.done, event);
    },
  });

  // El pago simulado avisa por las salas personales de comprador y vendedor.
// No hay sala por orden: son los dos unicos interesados y ambos ya estan
// unidos a su sala al conectar.
  setOrderRealtimeSink({
    orderPaid: (event) => {
      io.to(SOCKET_ROOMS.user(event.buyerId)).emit(SOCKET_EVENTS.order.paid, event);
      io.to(SOCKET_ROOMS.user(event.sellerId)).emit(SOCKET_EVENTS.order.paid, event);
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

    // Salas de chat. La pertenencia se valida contra la base: entrar a la sala
    // es recibir todos los mensajes de esa conversacion, y sin este chequeo
    // cualquier cuenta autenticada leeria conversaciones ajenas con un uuid.
    const joinChatRoom = async (chatId: string): Promise<boolean> => {
      try {
        // `assertParticipant` tira NOT_FOUND si el chat no es del usuario: es la
        // misma comprobacion que hacen los endpoints HTTP.
        await chatService.assertParticipant(chatId, auth.sub);
        await socket.join(SOCKET_ROOMS.chat(chatId));
        socket.emit(SOCKET_EVENTS.chat.join, { chatId });
        return true;
      } catch {
        emitError(socket, ERROR_CODES.NOT_FOUND, 'Chat not found');
        return false;
      }
    };

    socket.on(SOCKET_EVENTS.chat.join, (payload: { chatId?: unknown } = {}) => {
      const chatId = payload.chatId;
      if (typeof chatId !== 'string' || !isUuid(chatId)) {
        emitError(socket, ERROR_CODES.VALIDATION, 'chatId is required');
        return;
      }
      void joinChatRoom(chatId);
    });

    socket.on(SOCKET_EVENTS.chat.leave, (payload: { chatId?: unknown } = {}) => {
      if (typeof payload.chatId !== 'string') return;
      void socket.leave(SOCKET_ROOMS.chat(payload.chatId));
    });

    // Envio de mensajes por socket. Se emite a la sala, no solo de vuelta al
    // emisor: el remitente lo ve igual, y así no necesita un round-trip extra.
    socket.on(SOCKET_EVENTS.chat.message, (payload: { chatId?: unknown; content?: unknown } = {}) => {
      const { chatId, content } = payload;
      if (typeof chatId !== 'string' || !isUuid(chatId)) {
        emitError(socket, ERROR_CODES.VALIDATION, 'chatId is required');
        return;
      }
      if (typeof content !== 'string') {
        emitError(socket, ERROR_CODES.VALIDATION, 'content is required');
        return;
      }
      // Se entra a la sala antes de enviar: el servicio emite a la sala, asi
      // que el remitente recibe su propio mensaje por esa via y no por un
      // `socket.emit` aparte (que lo duplicaria).
      void joinChatRoom(chatId)
        .then((joined) => (joined ? chatService.sendMessage(chatId, auth.sub, { content }) : undefined))
        .catch((err: unknown) => {
          const code = (err as { code?: string })?.code === 'NOT_FOUND'
            ? ERROR_CODES.NOT_FOUND
            : ERROR_CODES.VALIDATION;
          emitError(socket, code, (err as Error)?.message ?? 'No se pudo enviar el mensaje');
        });
    });

    socket.on(SOCKET_EVENTS.chat.read, (payload: { chatId?: unknown } = {}) => {
      const chatId = payload.chatId;
      if (typeof chatId !== 'string' || !isUuid(chatId)) return;
      // `markRead` ya emite `chat:read` a la sala cuando hay algo que marcar.
      // Acá no se reemite al que pidió: lo veria dos veces.
      void chatService
        .markRead(chatId, auth.sub)
        .catch(() => emitError(socket, ERROR_CODES.NOT_FOUND, 'Chat not found'));
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
        setOrderRealtimeSink(null);
        // Sin cerrar las conexiones activas el proceso no termina.
        io.close(() => resolve());
      }),
  };
}

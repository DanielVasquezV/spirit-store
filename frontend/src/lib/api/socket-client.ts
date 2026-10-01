import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN } from './env';
import { getAccessToken } from './auth-token-store';
import type {
  AuctionClosedEvent,
  AuctionStartedEvent,
  BidPlacedEvent,
  ChatMessageEvent,
  ChatMessagesReadEvent,
  ConnectionErrorEvent,
  DiagnosticDoneEvent,
  OutbidEvent,
} from '@/lib/types/api';

/** Eventos que la app escucha, con el payload exacto que emite el backend. */
export interface ServerEventMap {
  'auction:bid-placed': BidPlacedEvent;
  'auction:outbid': OutbidEvent;
  'auction:started': AuctionStartedEvent;
  'auction:closed': AuctionClosedEvent;
  'chat:message': ChatMessageEvent;
  'chat:read': ChatMessagesReadEvent;
  'diagnostic:done': DiagnosticDoneEvent;
  'connection:error': ConnectionErrorEvent;
}

/**
 * `Socket` tipa `on` con un fallback que choca con nuestro mapa de payloads, así
 * que para suscribirse se usa esta vista laxa y el tipado real queda en `subscribe`.
 */
interface LooseEmitter {
  on(event: string, handler: (payload: unknown) => void): void;
  off(event: string, handler: (payload: unknown) => void): void;
}

export const SERVER_EVENTS = {
  auctionJoin: 'auction:join',
  auctionLeave: 'auction:leave',
  chatJoin: 'chat:join',
  chatLeave: 'chat:leave',
  chatMessage: 'chat:message',
  chatRead: 'chat:read',
} as const;

let socket: Socket | null = null;
let connecting: Promise<Socket> | null = null;

function handleServerDisconnect(instance: Socket): void {
  // El servidor corta la sesión a los 10 minutos con disconnect desde su lado, y
  // socket.io-client no reconecta solo en ese caso: hay que hacerlo con el token vigente.
  if (instance.connected) return;
  void getAccessToken().then((token) => {
    if (!token) return;
    // `auth` solo se lee al abrir la conexión, así que se actualiza antes de reconectar.
    instance.auth = { token };
    instance.connect();
  });
}

/** Conexión única y perezosa: la crea el primer hook que la necesita. */
export function connectSocket(): Promise<Socket> {
  if (socket?.connected) return Promise.resolve(socket);
  if (connecting) return connecting;

  connecting = getAccessToken().then((token) => {
    const instance = io(API_ORIGIN, {
      auth: token ? { token } : {},
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
    instance.on('disconnect', () => handleServerDisconnect(instance));
    socket = instance;
    connecting = null;
    return instance;
  });

  return connecting;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  connecting = null;
}

/** Conecta si hace falta y devuelve la función para dejar de escuchar. */
export async function subscribe<K extends keyof ServerEventMap>(
  event: K,
  handler: (payload: ServerEventMap[K]) => void,
): Promise<() => void> {
  const instance = (await connectSocket()) as unknown as LooseEmitter;
  const listener = handler as (payload: unknown) => void;
  instance.on(event, listener);
  return () => {
    instance.off(event, listener);
  };
}

export async function joinAuction(auctionId: string): Promise<void> {
  (await connectSocket()).emit(SERVER_EVENTS.auctionJoin, { auctionId });
}

export function leaveAuction(auctionId: string): void {
  socket?.emit(SERVER_EVENTS.auctionLeave, { auctionId });
}

export async function joinChat(chatId: string): Promise<void> {
  (await connectSocket()).emit(SERVER_EVENTS.chatJoin, { chatId });
}

export function leaveChat(chatId: string): void {
  socket?.emit(SERVER_EVENTS.chatLeave, { chatId });
}

export async function sendChatMessage(chatId: string, content: string): Promise<void> {
  (await connectSocket()).emit(SERVER_EVENTS.chatMessage, { chatId, content });
}

export function markChatRead(chatId: string): void {
  socket?.emit(SERVER_EVENTS.chatRead, { chatId });
}
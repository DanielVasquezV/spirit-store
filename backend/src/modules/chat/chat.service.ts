import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { emitChatMessage, emitChatMessagesRead } from '../../socket/chat-realtime.js';
import type { ChatType, MessageType, Prisma } from '../../generated/prisma/client.js';

// Conversaciones comprador <-> vendedor.
//
// El participante se deduce del token, nunca de un parametro. Un endpoint que
// acepta `buyerId` en el body abriria la puerta a leer conversaciones ajenas
// con un id.

// Lo que la lista necesita: el otro participante con nombre, el vehiculo de
// contexto y el ultimo mensaje para el preview. `title` no existe en Vehicle,
// se deriva de brand + model como en el catalogo.
const CHAT_LIST_INCLUDE = {
  buyer: { select: { id: true, fullName: true } },
  seller: { select: { id: true, fullName: true } },
  vehicle: {
    select: { id: true, brand: true, model: true, images: { orderBy: { position: 'asc' }, take: 1 } },
  },
} as const satisfies Prisma.ChatInclude;

const MESSAGE_INCLUDE = { sender: { select: { id: true, fullName: true } } } as const;

const CHAT_DETAIL_INCLUDE = {
  ...CHAT_LIST_INCLUDE,
  messages: { orderBy: { createdAt: 'desc' }, take: 1, include: MESSAGE_INCLUDE },
} as const satisfies Prisma.ChatInclude;

type ChatListRow = Prisma.ChatGetPayload<{ include: typeof CHAT_LIST_INCLUDE }>;
type ChatDetailRow = Prisma.ChatGetPayload<{ include: typeof CHAT_DETAIL_INCLUDE }>;

type MessageRow = Prisma.MessageGetPayload<{ include: typeof MESSAGE_INCLUDE }>;

export interface ChatMessageDto {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: MessageType;
  metadata: unknown;
  /**
   * Si **la contraparte** ya lo leyó. No es "lo leí yo": el schema tiene un solo
   * booleano por mensaje, no un estado por participante, así que un mensaje
   * propio siempre viene en `false` y el cliente tiene que comparar `senderId`
   * con su propio id para pintar los ticks.
   */
  isRead: boolean;
  createdAt: string;
}

export interface ChatPreviewDto {
  id: string;
  chatType: ChatType;
  vehicle: { id: string; title: string; imageUrl: string | null } | null;
  /** Siempre el otro, segun quien mire. */
  counterpart: { id: string; fullName: string };
  /** Lado de quien mira: el inbox agrupa en Compras/Ventas sin conocer buyerId. */
  viewerRole: 'BUYER' | 'SELLER';
  lastMessage: ChatMessageDto | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatPage {
  rows: ChatPreviewDto[];
  total: number;
}

export interface MessagePage {
  rows: ChatMessageDto[];
  total: number;
}

function toMessageDto(row: MessageRow): ChatMessageDto {
  return {
    id: row.id,
    chatId: row.chatId,
    senderId: row.senderId,
    senderName: row.sender.fullName,
    content: row.content,
    messageType: row.messageType,
    metadata: row.metadata ?? null,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPreview(row: ChatListRow | ChatDetailRow, viewerId: string, unreadCount: number): ChatPreviewDto {
  const counterpart = row.buyerId === viewerId ? row.seller : row.buyer;
  const last = (row as ChatDetailRow).messages[0];

  return {
    id: row.id,
    chatType: row.chatType,
    vehicle: row.vehicle
      ? {
        id: row.vehicle.id,
        title: `${row.vehicle.brand} ${row.vehicle.model}`.trim(),
        imageUrl: row.vehicle.images[0]?.url ?? null,
      }
      : null,
    counterpart: { id: counterpart.id, fullName: counterpart.fullName },
    viewerRole: row.buyerId === viewerId ? 'BUYER' : 'SELLER',
    lastMessage: last ? toMessageDto(last) : null,
    unreadCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Base de toda autorizacion: un chat es del `viewerId` solo si es parte de el.
 *
 * Devuelve el `chatId` del otro para poder dirigirle su evento por socket sin
 * una segunda consulta.
 */
export async function assertParticipant(chatId: string, viewerId: string): Promise<string> {
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, deletedAt: null, OR: [{ buyerId: viewerId }, { sellerId: viewerId }] },
    select: { id: true, buyerId: true, sellerId: true },
  });
  if (!chat) throw AppError.notFound('Chat');
  return chat.buyerId === viewerId ? chat.sellerId : chat.buyerId;
}

export interface CreateChatInput {
  vehicleId: string;
  chatType?: ChatType;
}

/**
 * Abre la conversacion con el vendedor de un vehiculo, o devuelve la que ya
 * existe.
 *
 * El `@@unique([vehicleId, buyerId, sellerId])` del schema es la garantia real de
 * que no queden dos conversaciones del mismo vehiculo entre las mismas dos
 * personas. Ahi se apoya `ensureChat`: si el insert se choca con la unique, es
 * que otro request la gano, y se relee en vez de fallar.
 *
 * El `upsert` de prisma resolveria lo mismo en un solo viaje, pero no dice si
 * creo la fila o la encontro, y sin eso el endpoint no puede distinguir un
 * `201` de un `200`: dos toques seguidos en "Consultar" responderian "creado" las
 * dos veces y un cliente que use el status para decidir si abrir la pantalla
 * abriria el mismo hilo dos veces.
 */
export async function createChat(
  viewerId: string,
  input: CreateChatInput,
): Promise<{ chat: ChatPreviewDto; created: boolean }> {
  const { vehicleId, chatType = 'PURCHASE' } = input;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, deletedAt: null },
    select: { id: true, sellerId: true },
  });
  if (!vehicle) throw AppError.notFound('Vehicle');

  // Hablar con uno mismo no es una consulta.
  if (vehicle.sellerId === viewerId) {
    throw AppError.badRequest('Validation failed', {
      vehicleId: 'No podes abrir un chat sobre tu propio vehiculo',
    });
  }

  // El vehiculo siempre aporta un solo vendedor, asi que el rol de cada parte
  // queda determinado: quien consulta es el comprador.
  const buyerId = viewerId;
  const sellerId = vehicle.sellerId;
  const key = { vehicleId_buyerId_sellerId: { vehicleId, buyerId, sellerId } };

  const existing = await prisma.chat.findFirst({
    where: { vehicleId, buyerId, sellerId, deletedAt: null },
    include: CHAT_DETAIL_INCLUDE,
  });
  if (existing) return { chat: toPreview(existing, viewerId, 0), created: false };

  try {
    const chat = await prisma.chat.create({
      data: { vehicleId, buyerId, sellerId, chatType },
      include: CHAT_DETAIL_INCLUDE,
    });
    return { chat: toPreview(chat, viewerId, 0), created: true };
  } catch (err) {
    // Choca con la unique: gano otro request entre el `findFirst` y el insert.
    // No es un error para el cliente, es el mismo chat que queria abrir.
    if (isUniqueViolation(err)) {
      const raced = await prisma.chat.findUniqueOrThrow({ where: key, include: CHAT_DETAIL_INCLUDE });
      return { chat: toPreview(raced, viewerId, 0), created: false };
    }
    throw err;
  }
}

/** `P2002`, el codigo de prisma para violacion de restriccion unica. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null
    && (err as { code?: unknown }).code === 'P2002';
}

export async function listChats(viewerId: string, page: { skip: number; take: number }): Promise<ChatPage> {
  const where = { deletedAt: null, OR: [{ buyerId: viewerId }, { sellerId: viewerId }] };

  const [total, rows] = await prisma.$transaction([
    prisma.chat.count({ where }),
    prisma.chat.findMany({
      where,
      include: CHAT_DETAIL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      skip: page.skip,
      take: page.take,
    }),
  ]);

  // Los no leidos se cuentan con un solo groupBy para toda la pagina: filtrar
  // por `senderId` en una relacion 1:N necesita un groupBy, y hacerlo por chat
  // seria N+1 consultas por pantalla.
  const unreadByChat = new Map<string, number>();
  const chatIds = rows.map((c) => c.id);
  if (chatIds.length > 0) {
    const groups = await prisma.message.groupBy({
      by: ['chatId'],
      where: { chatId: { in: chatIds }, isRead: false, senderId: { not: viewerId } },
      _count: { _all: true },
    });
    for (const g of groups) unreadByChat.set(g.chatId, g._count._all);
  }

  return { rows: rows.map((row) => toPreview(row, viewerId, unreadByChat.get(row.id) ?? 0)), total };
}

export async function listMessages(
  chatId: string,
  viewerId: string,
  page: { skip: number; take: number },
): Promise<MessagePage> {
  await assertParticipant(chatId, viewerId);

  const [total, rows] = await prisma.$transaction([
    prisma.message.count({ where: { chatId } }),
    prisma.message.findMany({
      where: { chatId },
      include: MESSAGE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: page.skip,
      take: page.take,
    }),
  ]);

  return { rows: rows.map(toMessageDto), total };
}

export interface SendMessageInput {
  content: string;
  messageType?: MessageType;
  metadata?: unknown;
}

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Guarda un mensaje y devuelve el DTO con el nombre del remitente resuelto.
 *
 * El `touch` del `updatedAt` va en la misma transaccion que el insert: es lo
 * que ordena la lista de conversaciones, y si se actualizara aparte una
 * conversacion con mensajes nuevos podria seguir apareciendo en su lugar viejo.
 */
export async function sendMessage(
  chatId: string,
  senderId: string,
  input: SendMessageInput,
): Promise<ChatMessageDto> {
  const recipientId = await assertParticipant(chatId, senderId);

  const content = input.content.trim();
  if (!content) throw AppError.badRequest('Validation failed', { content: 'content no puede estar vacio' });
  if (content.length > MAX_MESSAGE_LENGTH) {
    throw AppError.badRequest('Validation failed', {
      content: `content admite hasta ${MAX_MESSAGE_LENGTH} caracteres`,
    });
  }

  const messageType = input.messageType ?? 'TEXT';
  // OFFER lleva carga util: sin monto la oferta no significa nada.
  if (messageType === 'OFFER') {
    const amount = (input.metadata as { amount?: unknown } | null | undefined)?.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw AppError.badRequest('Validation failed', {
        metadata: 'una oferta (OFFER) necesita metadata.amount mayor a 0',
      });
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        chatId,
        senderId,
        content,
        messageType,
        ...(input.metadata === undefined ? {} : { metadata: input.metadata as Prisma.InputJsonValue }),
      },
      include: MESSAGE_INCLUDE,
    });
    await tx.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
    return created;
  });

  const dto = toMessageDto(message);
  // Despues del commit: emitir adentro le mostraria al otro un mensaje que
  // todavia puede fallar y deshacerse.
  emitChatMessage({ chatId, recipientId, message: dto });
  return dto;
}

/**
 * Marca como leidos los mensajes del otro, no los propios: uno propio ya esta
 * leido por definicion y marcarlo ensuciaria el contador.
 *
 * Devuelve cuantos cambiaron para que la app actualice el badge sin recargar.
 */
export async function markRead(chatId: string, viewerId: string): Promise<number> {
  await assertParticipant(chatId, viewerId);

  const { count } = await prisma.message.updateMany({
    where: { chatId, isRead: false, senderId: { not: viewerId } },
    data: { isRead: true },
  });
  // Solo si hubo algo que marcar: un evento de "0 leidos" cada vez que se abre
  // una conversacion es ruido.
  if (count > 0) emitChatMessagesRead({ chatId, readerId: viewerId, count });
  return count;
}

/** Total de no leidos del usuario, para el badge de la tab de chats. */
export async function countUnread(viewerId: string): Promise<number> {
  return prisma.message.count({
    where: {
      isRead: false,
      senderId: { not: viewerId },
      chat: { deletedAt: null, OR: [{ buyerId: viewerId }, { sellerId: viewerId }] },
    },
  });
}
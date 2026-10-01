import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/error-handler.js';
import { created, ok, paginated } from '../../lib/api-response.js';
import { parsePagination, readEnum, readString, requireUuid, Validator } from '../../lib/validate.js';
import type { ChatType, MessageType } from '../../generated/prisma/client.js';
import * as chatService from './chat.service.js';

// El usuario sale siempre del token. Ningun handler acepta un id de
// participante por parametro: por definicion no hay forma de preguntar por la
// conversacion de otro.

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const validator = new Validator();

  const vehicleId = readString(body, 'vehicleId');
  if (!vehicleId) validator.add('vehicleId', 'vehicleId es obligatorio');
  else if (!requireUuidSafe(vehicleId)) validator.add('vehicleId', 'vehicleId no es un uuid valido');

  const chatType = body.chatType === undefined
    ? undefined
    : readEnum(body, 'chatType', ['PURCHASE', 'SALE', 'AUCTION_WIN'] as const);

  validator.assert();

  const { chat, created: wasCreated } = await chatService.createChat(req.user!.id, {
    vehicleId: vehicleId!,
    chatType: chatType as ChatType | undefined,
  });
  // 201 solo cuando la conversacion no existia: un segundo toque en "Consultar"
  // devuelve 200 con el mismo chat, no un "creado" de algo que ya estaba.
  if (wasCreated) created(res, chat);
  else ok(res, chat);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, unknown>);
  const { rows, total } = await chatService.listChats(req.user!.id, pagination);
  paginated(res, rows, { page: pagination.page, pageSize: pagination.pageSize, total });
});

export const messages = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, unknown>);
  const { rows, total } = await chatService.listMessages(
    requireUuid(String(req.params.id)),
    req.user!.id,
    pagination,
  );
  paginated(res, rows, { page: pagination.page, pageSize: pagination.pageSize, total });
});

export const send = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const validator = new Validator();

  const content = readString(body, 'content');
  if (!content) validator.add('content', 'content es obligatorio');

  const messageType = body.messageType === undefined
    ? undefined
    : readEnum(body, 'messageType', ['TEXT', 'IMAGE', 'OFFER'] as const);

  validator.assert();

  const message = await chatService.sendMessage(
    requireUuid(String(req.params.id)),
    req.user!.id,
    {
      content: content!,
      messageType: messageType as MessageType | undefined,
      metadata: body.metadata,
    },
  );
  created(res, message);
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const updated = await chatService.markRead(requireUuid(String(req.params.id)), req.user!.id);
  ok(res, { markedAsRead: updated });
});

export const unread = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { unread: await chatService.countUnread(req.user!.id) });
});

// `requireUuid` tira 400 con un mensaje generico, que en el cuerpo de una
// validacion multiple se pierde: aca se acumula el error por campo y el
// Validator lo devuelve junto a los demas.
function requireUuidSafe(value: string): boolean {
  try {
    requireUuid(value, 'vehicleId');
    return true;
  } catch {
    return false;
  }
}
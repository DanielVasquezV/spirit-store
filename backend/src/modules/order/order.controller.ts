import type { Request, Response } from 'express';

import { AppError, asyncHandler } from '../../middleware/error-handler.js';
import { created, noContent, ok } from '../../lib/api-response.js';
import { readNumber, readQueryString, requireUuid, Validator } from '../../lib/validate.js';
import * as orderService from './order.service.js';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const validator = new Validator();

  const rawVehicleId = typeof body['vehicleId'] === 'string' ? body['vehicleId'].trim() : '';
  if (!rawVehicleId) validator.add('vehicleId', 'vehicleId es obligatorio');

  const rawChatId = typeof body['chatId'] === 'string' ? body['chatId'].trim() : '';
  const expectedVehiclePrice = readNumber(body, 'expectedVehiclePrice');
  if (expectedVehiclePrice !== undefined && expectedVehiclePrice < 0) {
    validator.add('expectedVehiclePrice', 'expectedVehiclePrice no puede ser negativo');
  }

  validator.assert();

  const order = await orderService.createOrder(req.user!.id, requireUuid(rawVehicleId), {
    ...(expectedVehiclePrice !== undefined ? { expectedVehiclePrice } : {}),
    ...(rawChatId ? { chatId: requireUuid(rawChatId, 'chatId') } : {}),
  });

  created(res, order);
});

export const createCheckoutSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await orderService.createCheckoutSession(
    req.user!.id,
    requireUuid(String(req.params.id)),
  );
  created(res, session);
});

export const confirm = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.confirmPayment(req.user!.id, requireUuid(String(req.params.id)));
  ok(res, order);
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  await orderService.cancelOrder(req.user!.id, requireUuid(String(req.params.id)));
  noContent(res);
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, unknown>;
  const rawRole = readQueryString(query['role']);
  if (rawRole !== undefined && rawRole !== 'buyer' && rawRole !== 'seller') {
    throw AppError.badRequest('Validation failed', {
      role: 'role debe ser buyer o seller',
    });
  }

  const orders = await orderService.listMyOrders(req.user!.id, rawRole ? { role: rawRole } : {});
  ok(res, orders);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrder(req.user!.id, requireUuid(String(req.params.id)));
  ok(res, order);
});
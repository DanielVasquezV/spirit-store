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

// Del medio de pago solo viaja lo que se puede mostrar en el comprobante: nunca el número completo ni el CVV.
function readPayment(body: Record<string, unknown>): orderService.PaymentInput {
  const validator = new Validator();
  const method = body['paymentMethod'];
  if (method === 'CARD') {
    const card = (body['card'] ?? {}) as Record<string, unknown>;
    const last4 = typeof card['last4'] === 'string' ? card['last4'] : '';
    const brand = typeof card['brand'] === 'string' ? card['brand'].trim() : '';
    const holderName = typeof card['holderName'] === 'string' ? card['holderName'].trim() : '';
    if (!/^\d{4}$/.test(last4)) validator.add('card.last4', 'card.last4 debe tener 4 digitos');
    if (!brand || brand.length > 20) validator.add('card.brand', 'card.brand es obligatorio');
    if (holderName.length < 3 || holderName.length > 80) validator.add('card.holderName', 'Escribi el nombre como aparece en la tarjeta');
    validator.assert();
    return { method: 'CARD', card: { last4, brand, holderName } };
  }
  if (method === 'BANK_TRANSFER') {
    const reference = typeof body['transferReference'] === 'string' ? body['transferReference'].trim() : '';
    if (!/^[A-Za-z0-9-]{4,30}$/.test(reference)) {
      validator.add('transferReference', 'La referencia debe tener entre 4 y 30 letras o numeros');
    }
    validator.assert();
    return { method: 'BANK_TRANSFER', transferReference: reference.toUpperCase() };
  }
  validator.add('paymentMethod', 'paymentMethod debe ser CARD o BANK_TRANSFER');
  validator.assert();
  throw AppError.badRequest('Validation failed');
}

export const confirm = asyncHandler(async (req: Request, res: Response) => {
  const payment = readPayment((req.body ?? {}) as Record<string, unknown>);
  const order = await orderService.confirmPayment(req.user!.id, requireUuid(String(req.params.id)), payment);
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
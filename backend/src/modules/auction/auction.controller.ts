import type { Request, Response } from 'express';

import { AppError, asyncHandler } from '../../middleware/error-handler.js';
import { created, noContent, ok, paginated } from '../../lib/api-response.js';
import {
  isUuid,
  parsePagination,
  readDate,
  readNumber,
  readQueryString,
  requireUuid,
  Validator,
} from '../../lib/validate.js';
import { AuctionStatus } from '../../generated/prisma/client.js';
import * as auctionService from './auction.service.js';
import { runAuctionLifecycle } from './auction.state.js';
import type { AuctionFilters } from './auction.service.js';

const ALLOWED_STATUS = Object.values(AuctionStatus);

function requester(req: Request): { id: string; role: string } {
  return { id: req.user!.id, role: req.user!.role };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, unknown>;
  const pagination = parsePagination(query);
  const filters: AuctionFilters = {};

  const status = readQueryString(query['status']);
  if (status !== undefined) {
    if (!(ALLOWED_STATUS as readonly string[]).includes(status)) {
      throw AppError.badRequest('Validation failed', {
        status: `status debe ser uno de: ${ALLOWED_STATUS.join(', ')}`,
      });
    }
    filters.status = status as (typeof ALLOWED_STATUS)[number];
  }
  const sellerId = readQueryString(query['sellerId']);
  if (sellerId) filters.sellerId = requireUuid(sellerId, 'sellerId');
  const vehicleId = readQueryString(query['vehicleId']);
  if (vehicleId) filters.vehicleId = requireUuid(vehicleId, 'vehicleId');

  const { rows, total } = await auctionService.listAuctions(filters, pagination);
  paginated(res, rows, { page: pagination.page, pageSize: pagination.pageSize, total });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const auction = await auctionService.getAuctionById(requireUuid(String(req.params.id)));
  if (!auction) throw AppError.notFound('Auction');
  ok(res, auction);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const validator = new Validator();

  const rawVehicleId = typeof body['vehicleId'] === 'string' ? body['vehicleId'].trim() : '';
  if (!rawVehicleId) {
    validator.add('vehicleId', 'vehicleId es obligatorio');
  } else if (!isUuid(rawVehicleId)) {
    validator.add('vehicleId', 'vehicleId debe ser un UUID valido');
  }

  const startingPrice = readNumber(body, 'startingPrice');
  if (startingPrice === undefined) validator.add('startingPrice', 'startingPrice es obligatorio');
  else if (startingPrice <= 0) validator.add('startingPrice', 'startingPrice debe ser mayor a 0');

  const minBidIncrement = readNumber(body, 'minBidIncrement');
  if (minBidIncrement !== undefined && minBidIncrement <= 0) {
    validator.add('minBidIncrement', 'minBidIncrement debe ser mayor a 0');
  }

  const endTime = readDate(body, 'endTime');
  if (!endTime) {
    validator.add('endTime', 'endTime es obligatorio');
  } else if (endTime.getTime() <= Date.now()) {
    validator.add('endTime', 'endTime debe ser una fecha futura');
  }
  const startTime = readDate(body, 'startTime');
  if (startTime && endTime && startTime.getTime() >= endTime.getTime()) {
    validator.add('startTime', 'startTime debe ser anterior a endTime');
  }

  validator.assert();

  created(
    res,
    await auctionService.createAuction(requester(req), {
      vehicleId: rawVehicleId,
      startingPrice: startingPrice!,
      endTime: endTime!,
      ...(startTime ? { startTime } : {}),
      ...(minBidIncrement !== undefined ? { minBidIncrement } : {}),
    }),
  );
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const validator = new Validator();

  const startingPrice = readNumber(body, 'startingPrice');
  if (startingPrice !== undefined && startingPrice <= 0) {
    validator.add('startingPrice', 'startingPrice debe ser mayor a 0');
  }
  const minBidIncrement = readNumber(body, 'minBidIncrement');
  if (minBidIncrement !== undefined && minBidIncrement <= 0) {
    validator.add('minBidIncrement', 'minBidIncrement debe ser mayor a 0');
  }
  const startTime = readDate(body, 'startTime');
  const endTime = readDate(body, 'endTime');
  if (startTime && endTime && startTime.getTime() >= endTime.getTime()) {
    validator.add('startTime', 'startTime debe ser anterior a endTime');
  }

  validator.assert();

  ok(
    res,
    await auctionService.updateAuction(requireUuid(String(req.params.id)), requester(req), {
      ...(startingPrice !== undefined ? { startingPrice } : {}),
      ...(minBidIncrement !== undefined ? { minBidIncrement } : {}),
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
    }),
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await auctionService.cancelAuction(requireUuid(String(req.params.id)), requester(req));
  noContent(res);
});

/**
 * Dispara a mano el ciclo de vida. El servidor lo corre solo cada 15s, asi que
 * esto solo hace falta de forma operacional (despues de una caida larga, o para
 * no esperar al tick en una prueba). Es la misma funcion que usa el timer, no un
 * camino alterno con reglas propias.
 */
export const runLifecycle = asyncHandler(async (_req: Request, res: Response) => {
  const result = await runAuctionLifecycle();
  ok(res, result);
});


const HISTORY_ROLES = ['seller', 'winner', 'bidder'] as const;

// Registro del usuario: subastas que creó y en las que pujó, con filtros por rol, estado y texto.
export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, unknown>;
  const pagination = parsePagination(query);
  const filters: auctionService.AuctionHistoryFilters = {};

  const role = readQueryString(query['role']);
  if (role !== undefined) {
    if (!(HISTORY_ROLES as readonly string[]).includes(role)) {
      throw AppError.badRequest('Validation failed', { role: `role debe ser uno de: ${HISTORY_ROLES.join(', ')}` });
    }
    filters.role = role as (typeof HISTORY_ROLES)[number];
  }
  const status = readQueryString(query['status']);
  if (status !== undefined) {
    if (!(ALLOWED_STATUS as readonly string[]).includes(status)) {
      throw AppError.badRequest('Validation failed', { status: `status debe ser uno de: ${ALLOWED_STATUS.join(', ')}` });
    }
    filters.status = status as (typeof ALLOWED_STATUS)[number];
  }
  const q = readQueryString(query['q']);
  if (q) filters.q = q;

  const { rows, total } = await auctionService.listMyAuctions(req.user!.id, filters, pagination);
  paginated(res, rows, { page: pagination.page, pageSize: pagination.pageSize, total });
});

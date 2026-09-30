import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/error-handler.js';
import { created, paginated } from '../../lib/api-response.js';
import { parsePagination, readNumber, requireUuid, Validator } from '../../lib/validate.js';
import * as bidService from './bid.service.js';

function requester(req: Request): { id: string; role: string } {
  return { id: req.user!.id, role: req.user!.role };
}

export const place = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const validator = new Validator();

  const amount = readNumber(body, 'amount');
  if (amount === undefined) validator.add('amount', 'amount es obligatorio');
  else if (amount <= 0) validator.add('amount', 'amount debe ser mayor a 0');

  validator.assert();

  const result = await bidService.placeBid(requireUuid(String(req.params.id)), requester(req), amount!);
  // Se devuelve la subasta ademas de la puja para que la app actualice contador,
  // ganador y minimo siguiente con la misma respuesta.
  created(res, { bid: result.bid, auction: result.auction, minimumNextBid: result.minimumNextBid });
});

export const listForAuction = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, unknown>);
  const { rows, total } = await bidService.listAuctionBids(requireUuid(String(req.params.id)), pagination);
  paginated(res, rows, { page: pagination.page, pageSize: pagination.pageSize, total });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, unknown>);
  const { rows, total } = await bidService.listMyBids(requester(req).id, pagination);
  paginated(res, rows, { page: pagination.page, pageSize: pagination.pageSize, total });
});
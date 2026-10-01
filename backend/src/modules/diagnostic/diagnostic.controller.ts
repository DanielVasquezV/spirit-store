import type { Request, Response } from 'express';

import { asyncHandler } from '../../middleware/error-handler.js';
import { created, ok, paginated } from '../../lib/api-response.js';
import { parsePagination, readInteger, readString, requireUuid, Validator } from '../../lib/validate.js';
import * as diagnosticService from './diagnostic.service.js';

const userId = (req: Request): string => req.user!.id;

export const availability = asyncHandler(async (_req: Request, res: Response) => {
  // El cliente usa esto para no mostrar el boton de "diagnosticar" si la key
  // no esta cargada: mejor un boton que no aparece que un error al tocarlo.
  ok(res, { available: diagnosticService.diagnosticsAvailable() });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const validator = new Validator();

  const title = readString(body, 'title');
  if (!title) validator.add('title', 'title es obligatorio');

  const year = readInteger(body, 'vehicleYear');
  if (body.vehicleYear !== undefined && year === undefined) {
    validator.add('vehicleYear', 'vehicleYear tiene que ser un entero');
  }

  const mileage = readInteger(body, 'mileage');
  if (body.mileage !== undefined && mileage === undefined) {
    validator.add('mileage', 'mileage tiene que ser un entero');
  }
  if (mileage !== undefined && mileage < 0) validator.add('mileage', 'mileage no puede ser negativo');

  validator.assert();

  const diagnostic = await diagnosticService.createDiagnostic(userId(req), {
    title: title!,
    vehicleId: typeof body.vehicleId === 'string' ? requireUuid(body.vehicleId, 'vehicleId') : undefined,
    vehicleBrand: readString(body, 'vehicleBrand'),
    vehicleModel: readString(body, 'vehicleModel'),
    vehicleYear: year,
    mileage,
    symptoms: body.symptoms,
  });

  created(res, diagnostic);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.query as Record<string, unknown>);
  const { rows, total } = await diagnosticService.listDiagnostics(userId(req), pagination);
  paginated(res, rows, { page: pagination.page, pageSize: pagination.pageSize, total });
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  ok(res, await diagnosticService.getDiagnostic(userId(req), requireUuid(String(req.params.id))));
});

export const resolve = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const resolved = body.resolved === undefined ? true : Boolean(body.resolved);
  ok(res, await diagnosticService.markResolved(userId(req), requireUuid(String(req.params.id)), resolved));
});

export const ask = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const validator = new Validator();

  const question = readString(body, 'question');
  if (!question) validator.add('question', 'question es obligatoria');

  validator.assert();

  const answer = await diagnosticService.askFollowUp(
    userId(req),
    requireUuid(String(req.params.id)),
    question!,
  );
  ok(res, { answer });
});
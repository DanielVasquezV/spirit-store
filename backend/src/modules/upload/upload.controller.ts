import type { Request, Response } from 'express';

import { asyncHandler, AppError } from '../../middleware/error-handler.js';
import { created, noContent, ok } from '../../lib/api-response.js';
import * as uploadService from './upload.service.js';
import type { UploadKind } from './upload.service.js';

const KINDS: readonly UploadKind[] = ['vehicles', 'dui', 'chat', 'misc'];

// Lista blanca: sin ella, un usuario escribiría rutas arbitrarias en el nombre
// del asset de Cloudinary.
function readKind(value: unknown): UploadKind {
  if (typeof value === 'string' && (KINDS as readonly string[]).includes(value)) {
    return value as UploadKind;
  }
  if (value === undefined) return 'misc';
  throw AppError.badRequest(`kind debe ser uno de: ${KINDS.join(', ')}`);
}

/** Firma para subir directo a Cloudinary. */
export const sign = asyncHandler(async (req: Request, res: Response) => {
  const kind = readKind((req.body as Record<string, unknown> | undefined)?.['kind']);
  ok(res, uploadService.signUpload(kind));
});

/** Subida proxy: el archivo viene en el multipart, campo `file`. */
export const uploadOne = asyncHandler(async (req: Request, res: Response) => {
  // uploadSingle ya garantiza que exista; esto es solo para el tipado.
  const file = req.file;
  if (!file) throw AppError.badRequest("Falta el archivo en el campo 'file'");

  const kind = readKind((req.body as Record<string, unknown> | undefined)?.['kind']);

  const asset = await uploadService.uploadFile(
    {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
    },
    req.auth!.sub,
    kind,
  );

  created(res, asset);
});

// El publicId va por query y no por path: trae barras
// (spiritapex/vehicles/<userId>/<ts>-<rand>) y Express no las deja pasar en un
// :param de un solo segmento.
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const publicId = req.query['publicId'];
  if (typeof publicId !== 'string' || !publicId) {
    throw AppError.badRequest('Falta el query param publicId');
  }

  const rawKind = req.query['kind'];
  await uploadService.deleteAsset(publicId, rawKind === undefined ? undefined : readKind(rawKind));
  noContent(res);
});

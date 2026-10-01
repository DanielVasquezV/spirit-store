import multer from 'multer';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { ALLOWED_MIME_TYPES } from '../config/storage.js';
import { env } from '../config/env.js';
import { AppError } from './error-handler.js';
import { ERROR_CODES } from '../lib/api-response.js';

// En memoria y no en disco: los archivos van directo a Supabase Storage, no hay
// motivo para escribirlos ni para limpiarlos después.
const memoryStorage = multer.memoryStorage();

// Filtra por el mime declarado en el multipart, que es una comprobación barata
// de cara al cliente y no del contenido: cualquiera puede mandar bytes
// declarando image/jpeg. Por eso el service vuelve a validar.
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(
    new AppError(
      415,
      ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      `Tipo de archivo no permitido: ${file.mimetype}`,
    ),
  );
};

const multerInstance = multer({
  storage: memoryStorage,
  limits: {
    // El techo de tamaño es lo que evita que un archivo enorme agote la RAM.
    fileSize: env.storage.maxFileSizeBytes,
    // Una petición = un archivo. Las galerías van de a una para poder
    // reordenar o borrar en cascada.
    files: 1,
    fields: 4,
  },
  fileFilter,
});

/**
 * Traduce los errores de multer al contrato de error de la API. Sin esto, un
 * archivo demasiado grande llegaria al cliente como un 500 opaco en vez de un
 * 413 con el limite concreto.
 */
function handleMulterError(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!(err instanceof multer.MulterError)) {
    next(err);
    return;
  }

  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      next(
        AppError.badRequest(
          `El archivo excede el máximo de ${Math.round(env.storage.maxFileSizeBytes / 1024 / 1024)} MB`,
          { field: err.field, maxBytes: env.storage.maxFileSizeBytes },
        ),
      );
      return;
    case 'LIMIT_UNEXPECTED_FILE':
      next(AppError.badRequest(`Campo de archivo inesperado: ${err.field ?? 'desconocido'}`));
      return;
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_FIELD_COUNT':
      next(AppError.badRequest('Demasiados campos en la petición'));
      return;
    default:
      next(AppError.badRequest(`No se pudo procesar el archivo: ${err.message}`));
  }
}

/** Acepta un archivo en el campo `file`. */
export const uploadSingle: RequestHandler = (req, res, next) => {
  multerInstance.single('file')(req, res, (err: unknown) => {
    if (err) {
      handleMulterError(err, req, res, next);
      return;
    }
    if (!req.file) {
      next(AppError.badRequest("Falta el archivo en el campo 'file'"));
      return;
    }
    next();
  });
};

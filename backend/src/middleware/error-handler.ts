import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

import { ERROR_CODES, fail } from '../lib/api-response.js';
import { env } from '../config/env.js';

// Los servicios lanzan esto y el middleware global lo traduce a respuesta HTTP,
// así el servicio no sabe nada del transporte.
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, ERROR_CODES.VALIDATION, message, details);
  }

  static unauthenticated(message = 'Authentication required'): AppError {
    return new AppError(401, ERROR_CODES.UNAUTHENTICATED, message);
  }

  static forbidden(message = 'Insufficient permissions'): AppError {
    return new AppError(403, ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(resource = 'Resource'): AppError {
    return new AppError(404, ERROR_CODES.NOT_FOUND, `${resource} not found`);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(409, ERROR_CODES.CONFLICT, message, details);
  }
}

// Express 5 ya propaga los rechazos de handlers async, pero el wrapper lo deja
// explícito y sigue funcionando si el proyecto vuelve a Express 4.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  fail(res, 404, ERROR_CODES.NOT_FOUND, `Route ${req.method} ${req.originalUrl} not found`);
}

// Sin esto, un correo duplicado o un VIN repetido llegarían como un 500 opaco.
function fromPrismaError(err: Prisma.PrismaClientKnownRequestError): AppError | null {
  switch (err.code) {
    case 'P2002':
      return new AppError(
        409,
        ERROR_CODES.CONFLICT,
        'A record with the same unique value already exists',
        { fields: err.meta?.['target'] },
      );
    case 'P2003':
      return new AppError(
        400,
        ERROR_CODES.VALIDATION,
        'Referenced record does not exist',
        { field: err.meta?.['field_name'] },
      );
    case 'P2025':
      return new AppError(404, ERROR_CODES.NOT_FOUND, 'Record not found');
    default:
      return null;
  }
}

// Único lugar donde se decide qué se filtra: lo no reconocido se loguea entero
// y se responde con un mensaje genérico, para no filtrar detalles de la base ni
// del proveedor de IA.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    // Ya se escribieron headers: que el handler de Express destruya la conexión.
    next(err);
    return;
  }

  if (err instanceof AppError) {
    fail(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = fromPrismaError(err);
    if (mapped) {
      fail(res, mapped.statusCode, mapped.code, mapped.message, mapped.details);
      return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    fail(res, 400, ERROR_CODES.VALIDATION, 'Malformed query or payload');
    return;
  }

  // JSON mal formado: lo lanza body-parser antes de llegar a los handlers.
  if (err instanceof SyntaxError && 'body' in err) {
    fail(res, 400, ERROR_CODES.VALIDATION, 'Request body is not valid JSON');
    return;
  }

  console.error('[unhandled-error]', err);
  fail(
    res,
    500,
    ERROR_CODES.INTERNAL,
    env.isProduction ? 'Internal server error' : String((err as Error)?.message ?? err),
  );
}

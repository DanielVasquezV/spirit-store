import type { Response } from 'express';

// Un único shape para que el cliente no tenga que parsear dos: todo lo que sale
// por HTTP, o por el canal de errores del socket, pasa por acá.
//
//   exito -> { success: true, data, meta? }
//   error -> { success: false, error: { code, message, details? } }
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** El cliente decide por `code`, no por el texto del mensaje. */
export const ERROR_CODES = {
  VALIDATION: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL_ERROR',
} as const;

export function ok<T>(res: Response, data: T, statusCode = 200, meta?: ApiMeta): void {
  const body: ApiSuccess<T> = meta ? { success: true, data, meta } : { success: true, data };
  res.status(statusCode).json(body);
}

export function created<T>(res: Response, data: T): void {
  ok(res, data, 201);
}

export function noContent(res: Response): void {
  res.status(204).end();
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; pageSize: number; total: number },
): void {
  res.status(200).json({
    success: true,
    data,
    meta: {
      ...meta,
      totalPages: meta.pageSize > 0 ? Math.ceil(meta.total / meta.pageSize) : 0,
    },
  } satisfies ApiSuccess<T[]>);
}

export function fail(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: ApiError = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  res.status(statusCode).json(body);
}

// Errores tipados del backend: la app decide por `code`, nunca por el texto del mensaje.
export const API_ERROR_CODES = {
  VALIDATION: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL_ERROR',
  DUI_REQUIRED: 'DUI_REQUIRED',
  PAYMENT_DECLINED: 'PAYMENT_DECLINED',
  ORDER_EXPIRED: 'ORDER_EXPIRED',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

// En VALIDATION_ERROR `details` es un mapa campo → mensaje que los inputs pintan sin parsear texto.
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error) || error.code !== API_ERROR_CODES.VALIDATION || !error.details) return {};
  return Object.fromEntries(
    Object.entries(error.details).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

export function messageFor(error: unknown, fallback = 'Algo salió mal. Intentá de nuevo.'): string {
  return isApiError(error) ? error.message : fallback;
}

export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

export function hasCode(error: unknown, code: ApiErrorCode): boolean {
  return isApiError(error) && error.code === code;
}

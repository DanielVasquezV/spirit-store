import { API_ERROR_CODES, ApiError, type ApiErrorCode } from './api-error';
import { getAccessToken } from './auth-token-store';
import { API_ORIGIN, API_PREFIX, REQUEST_TIMEOUT_MS, buildQuery, type QueryValue } from './env';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: { page: number; pageSize: number; total: number; totalPages: number };
}

interface FailureEnvelope {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
}

/** Lo que devuelve un listado paginado, ya normalizado para las listas de la app. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RequestConfig {
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

// El cliente no conoce el estado de sesión: el provider le inyecta qué hacer
// cuando la API responde 401, y así ningún módulo de datos reimplementa el logout.
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

// AbortSignal.any no existe en Hermes, así que el timeout se encadena a mano.
function withTimeout(ms: number, signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  return { signal: controller.signal, done: () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); } };
}

async function request<T>(method: string, path: string, config: RequestConfig = {}): Promise<SuccessEnvelope<T> | null> {
  const url = `${API_ORIGIN}${API_PREFIX}${path}${buildQuery(config.query)}`;
  const token = await getAccessToken();
  const { signal, done } = withTimeout(config.timeoutMs ?? REQUEST_TIMEOUT_MS, config.signal);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(config.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(config.body === undefined ? {} : { body: JSON.stringify(config.body) }),
    });
  } catch {
    // fetch solo rechaza por red o por abort: en ambos casos la app necesita un
    // error tipado para pintar su estado de error y no un ReferenceError.
    throw new ApiError(0, API_ERROR_CODES.INTERNAL, 'No pudimos conectar con el servidor.');
  } finally {
    done();
  }

  if (response.status === 204) return null;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const failure = payload as FailureEnvelope | null;
    const code = (failure?.error?.code ?? API_ERROR_CODES.INTERNAL) as ApiErrorCode;
    const message = failure?.error?.message ?? 'Algo salió mal. Intentá de nuevo.';
    if (response.status === 401) onUnauthorized?.();
    throw new ApiError(response.status, code, message, failure?.error?.details);
  }

  return payload as SuccessEnvelope<T>;
}

export const http = {
  get: async <T>(path: string, config?: RequestConfig): Promise<T> => {
    const envelope = await request<T>('GET', path, config);
    return envelope!.data;
  },

  post: async <T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> => {
    const envelope = await request<T>('POST', path, { ...config, body: body ?? {} });
    return envelope!.data;
  },

  patch: async <T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> => {
    const envelope = await request<T>('PATCH', path, { ...config, body: body ?? {} });
    return envelope!.data;
  },

  delete: async (path: string, config?: RequestConfig): Promise<void> => {
    await request<never>('DELETE', path, config);
  },

  paginated: async <T>(path: string, config?: RequestConfig): Promise<Paginated<T>> => {
    const envelope = await request<T[]>('GET', path, config);
    const meta = envelope?.meta;
    return {
      items: envelope?.data ?? [],
      page: meta?.page ?? 1,
      pageSize: meta?.pageSize ?? 0,
      total: meta?.total ?? 0,
      totalPages: meta?.totalPages ?? 0,
    };
  },
};
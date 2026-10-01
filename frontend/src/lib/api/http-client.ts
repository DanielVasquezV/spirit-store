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

// Lo que devuelve un listado paginado, ya normalizado para las listas de la app.
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

// El provider inyecta qué hacer ante un 401 para que ningún módulo de datos reimplemente el logout.
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
  // Con FormData el boundary del multipart lo pone fetch: fijar Content-Type a mano lo rompe.
  const isForm = typeof FormData !== 'undefined' && config.body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(config.body === undefined || isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(config.body === undefined ? {} : { body: isForm ? (config.body as FormData) : JSON.stringify(config.body) }),
    });
  } catch (error) {
    // fetch solo rechaza por red o abort: se tipa el error para que la pantalla pinte su estado de error.
    console.log('Error de conexión:', error);
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
    // Acciones como cancelar responden 204 sin cuerpo: no hay `data` que devolver.
    return envelope?.data as T;
  },

  patch: async <T>(path: string, body?: unknown, config?: RequestConfig): Promise<T> => {
    const envelope = await request<T>('PATCH', path, { ...config, body: body ?? {} });
    return envelope!.data;
  },

  upload: async <T>(path: string, form: FormData, config?: RequestConfig): Promise<T> => {
    // Las fotos pesan más que un JSON: el timeout por defecto corta subidas lentas en 4G.
    const envelope = await request<T>('POST', path, { timeoutMs: 60_000, ...config, body: form });
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
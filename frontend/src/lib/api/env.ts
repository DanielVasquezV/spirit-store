import { Platform } from 'react-native';
import Constants from 'expo-constants';

// EXPO_PUBLIC_* lo inlinea Metro; `extra` de app.json queda de respaldo para builds sin esa variable.
const fromConfig = Constants.expoConfig?.extra?.apiUrl as string | undefined;

function configuredOrigin(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? fromConfig ?? 'http://localhost:8081';
}

function isLoopback(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/i.test(origin);
}

// En un teléfono el host de Metro es la LAN del Mac; localhost sería el propio celular.
function metroLanHost(): string | null {
  const candidates = [Constants.expoConfig?.hostUri, Constants.linkingUri];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const ip = candidate.match(/(\d{1,3}(?:\.\d{1,3}){3})/)?.[1];
    if (ip && ip !== '127.0.0.1') return ip;
  }
  return null;
}

function resolveApiOrigin(): string {
  const origin = configuredOrigin();
  if (!isLoopback(origin)) return origin;

  const lan = metroLanHost();
  if (lan) return origin.replace(/localhost|127\.0\.0\.1/i, lan);

  // El emulador de Android no comparte el localhost del host.
  if (Platform.OS === 'android') return origin.replace(/localhost|127\.0\.0\.1/i, '10.0.2.2');
  return origin;
}

export const API_ORIGIN = resolveApiOrigin();

// El backend monta todo bajo /api; el cliente nunca repite ese prefijo.
export const API_PREFIX = '/api';

export const REQUEST_TIMEOUT_MS = 15000;

export type QueryValue = string | number | boolean | undefined | null;

export function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

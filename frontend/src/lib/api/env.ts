import Constants from 'expo-constants';

// La URL de la API viaja como EXPO_PUBLIC_* para que Metro la inlinee; el bloque
// `extra` queda como respaldo para builds donde se configura desde app.json.
const fromConfig = Constants.expoConfig?.extra?.apiUrl as string | undefined;

export const API_ORIGIN = process.env.EXPO_PUBLIC_API_URL ?? fromConfig ?? 'http://localhost:4000';

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
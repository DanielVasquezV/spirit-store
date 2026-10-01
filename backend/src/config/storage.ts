import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

export type UploadKind = 'vehicles' | 'dui' | 'chat' | 'misc';

// Fotos de galería y el PDF del DUI.
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export function isStorageConfigured(): boolean {
  return Boolean(env.storage.url && env.storage.serviceKey);
}

let client: SupabaseClient | null = null;

// Inicialización perezosa: sin credenciales la API arranca igual y solo /uploads responde 503.
export function storageClient(): SupabaseClient {
  client ??= createClient(env.storage.url!, env.storage.serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function bucketName(): string {
  return env.storage.bucket;
}

// Carpeta raíz de todo el media de la app.
export function rootFolder(): string {
  return env.storage.folder;
}

export function uploadFolder(kind: UploadKind): string {
  return `${rootFolder()}/${kind}`;
}

// URL de un bucket público de Supabase: se sirve por CDN sin credenciales.
export function publicUrl(path: string): string {
  return `${env.storage.url}/storage/v1/object/public/${env.storage.bucket}/${path}`;
}

const SUPABASE_PUBLIC_PATH = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//;

// Solo el bucket propio; sin proyecto configurado (solo fuera de producción) se acepta cualquiera para no frenar el desarrollo.
export function isOwnStorageUrl(url: string): boolean {
  if (!env.storage.url) return SUPABASE_PUBLIC_PATH.test(url);
  return url.startsWith(`${env.storage.url}/storage/v1/object/public/${env.storage.bucket}/`);
}

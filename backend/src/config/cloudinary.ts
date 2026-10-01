import { v2 as cloudinary } from 'cloudinary';
import type { TransformationOptions } from 'cloudinary';
import { env } from './env.js';

// Cloudinary acepta todo en una URL (`cloudinary://key:secret@cloud`) o en
// variables sueltas. Las dos formas andan; lo único que viaja al móvil es la
// API key pública, el secret nunca sale del backend.
const CLOUDINARY_URL = process.env['CLOUDINARY_URL'];
const CLOUD_NAME = process.env['CLOUDINARY_CLOUD_NAME'];
const API_KEY = process.env['CLOUDINARY_API_KEY'];
const API_SECRET = process.env['CLOUDINARY_API_SECRET'];

// Solo las claves definidas. El merge del SDK pisa también las claves con
// `undefined`, y mandar `{ api_key: undefined }` borra la que acaban de parsear
// de CLOUDINARY_URL: todo falla con "Must supply api_key".
cloudinary.config({
  ...(CLOUDINARY_URL ? { cloudinary_url: CLOUDINARY_URL } : {}),
  ...(CLOUD_NAME ? { cloud_name: CLOUD_NAME } : {}),
  ...(API_KEY ? { api_key: API_KEY } : {}),
  ...(API_SECRET ? { api_secret: API_SECRET } : {}),
  secure: true,
});

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUDINARY_URL || (CLOUD_NAME && API_KEY && API_SECRET));
}

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function cloudinaryCredentials(): CloudinaryCredentials {
  // Sin argumentos devuelve la config ya resuelta. Se relee en cada llamada
  // porque es estado global del SDK.
  const parsed = cloudinary.config();
  return {
    cloudName: String(parsed.cloud_name ?? ''),
    apiKey: String(parsed.api_key ?? ''),
    apiSecret: String(parsed.api_secret ?? ''),
  };
}

/** Carpeta raíz de todo el media de la app. */
export function rootFolder(): string {
  return env.cloudinary.folder;
}

/** Carpeta destino de una subida. */
export function uploadFolder(kind: 'vehicles' | 'dui' | 'chat' | 'misc'): string {
  return `${rootFolder()}/${kind}`;
}

// Se aplica al subir, no al servir: así mostrar imágenes no depende de un
// round-trip a Cloudinary. `quality`/`fetch_format` auto eligen AVIF o WebP
// según el cliente, y 2000px con crop limit cubren una pantalla retina.
//
// Ojo con el formato: es un array de UN componente, no el string con barras
// `q_auto/f_auto/...` de la URL. El SDK ve las barras como separadores, se
// come `q_auto` como nombre de transformación y la subida muere con
// "Unknown transformation q_auto".
export const UPLOAD_TRANSFORMATION: TransformationOptions[] = [
  {
    quality: 'auto',
    fetch_format: 'auto',
    width: 2000,
    height: 2000,
    crop: 'limit',
  },
];

// La misma transformación como string, que es como viaja en los parámetros
// firmados. Se deriva del array en vez de escribirla a mano para que firmar y
// subir no puedan desincronizarse.
export function uploadTransformationString(): string {
  return cloudinary.utils.generate_transformation_string(UPLOAD_TRANSFORMATION);
}

/** Fotos de galería y el PDF del DUI. */
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export { cloudinary };

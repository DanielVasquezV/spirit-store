import { projectRoot } from '../lib/env-loader.js';
import { resolve } from 'node:path';

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

// Las críticas (DATABASE_URL, JWT_SECRET) fallan siempre. Las de integraciones
// externas solo en producción: en local el módulo de IA tiene que poder
// degradar a "no disponible" en vez de tumbar el proceso entero.
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is missing. Create ${resolve(projectRoot, '.env')} from .env.example at the monorepo root.`,
    );
  }
  return value;
}

function optional(name: string, value: string | undefined): string | undefined {
  if (!value && isProduction) {
    throw new Error(`${name} is required when NODE_ENV=production.`);
  }
  return value || undefined;
}

function toInt(name: string, value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (value === undefined) return fallback;
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer, received "${value}".`);
  }
  return parsed;
}

// En producción la lista tiene que ser explícita: un `*` por un error de
// despliegue abriría la API a todo internet.
function parseClientUrls(raw: string): true | string[] {
  const list = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (list.length === 0 || list.includes('*')) {
    if (isProduction) {
      throw new Error(
        'CLIENT_URL must list explicit origins in production (e.g. https://app.spiritapex.com).',
      );
    }
    return true;
  }
  return list;
}

export const env = {
  port: toInt('PORT', process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction,
  databaseUrl: required('DATABASE_URL', process.env.DATABASE_URL),
  clientUrl: parseClientUrls(process.env.CLIENT_URL ?? '*'),

  jwt: {
    secret: required('JWT_SECRET', process.env.JWT_SECRET),
    // 7 días: un comprador puede dejar una puja abierta varios días.
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  bcrypt: {
    // ~250ms por hash en hardware de servidor: el tope para un login interactivo.
    saltRounds: toInt('BCRYPT_SALT_ROUNDS', process.env.BCRYPT_SALT_ROUNDS, 12),
  },

  gemini: {
    apiKey: optional('GEMINI_API_KEY', process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  },

  cloudinary: {
    // Aislar el media de la app permite borrarla entera sin tocar otras
    // carpetas del mismo plan de Cloudinary.
    folder: process.env.CLOUDINARY_FOLDER ?? 'spiritapex',
    // Las fotos del móvil rara vez pasan de 8 MB, y multer las mantiene en
    // memoria: el corte evita que un archivo grande agote la RAM del proceso.
    maxFileSizeBytes:
      toInt('CLOUDINARY_MAX_FILE_SIZE_MB', process.env.CLOUDINARY_MAX_FILE_SIZE_MB, 8) * 1024 * 1024,
  },

  // En producción solo si se pide a mano: la UI deja disparar llamadas reales
  // contra la API desplegada desde el navegador.
  swaggerEnabled:
    (process.env.SWAGGER_ENABLED ?? '').toLowerCase() === 'true' || !isProduction,
} as const;

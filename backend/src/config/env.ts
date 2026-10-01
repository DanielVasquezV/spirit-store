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

function toNumber(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number, received "${value}".`);
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

  ai: {
    // Groq por defecto, pero cualquier API compatible con OpenAI sirve (DeepSeek, OpenRouter) cambiando la URL.
    apiKey: optional('GROQ_API_KEY', process.env.GROQ_API_KEY),
    baseUrl: process.env.AI_BASE_URL ?? 'https://api.groq.com/openai/v1',
    model: process.env.AI_MODEL ?? 'openai/gpt-oss-120b',
  },

  storage: {
    // URL del proyecto (https://<ref>.supabase.co) y la clave service_role: solo vive en el backend.
    url: optional('SUPABASE_URL', process.env.SUPABASE_URL)?.replace(/\/+$/, ''),
    serviceKey: optional('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'spirit-store',
    // Aislar el media de la app permite borrarla entera sin tocar otros archivos del bucket.
    folder: process.env.STORAGE_FOLDER ?? 'spiritapex',
    // multer mantiene el archivo en memoria: el corte evita que uno grande agote la RAM del proceso.
    maxFileSizeBytes: toInt('UPLOAD_MAX_FILE_SIZE_MB', process.env.UPLOAD_MAX_FILE_SIZE_MB, 8) * 1024 * 1024,
  },

  // En producción solo si se pide a mano: la UI deja disparar llamadas reales
  // contra la API desplegada desde el navegador.
  swaggerEnabled:
    (process.env.SWAGGER_ENABLED ?? '').toLowerCase() === 'true' || !isProduction,

  orders: {
    // Tasa de impuesto que se aplica al crear la orden. Es una constante del
    // negocio (13% en El Salvador) y vive en env para poder cambiarla sin
    // desplegar: el snapshot de cada orden guarda la tasa usada en su momento.
    taxRate: toNumber('TAX_RATE', process.env.TAX_RATE, 0.13),
    currency: process.env.DEFAULT_CURRENCY ?? 'USD',
    // Minutos que una orden puede quedar PENDING_PAYMENT antes de liberarse.
    // Sin esto, un vehiculo reservado se bloquea para siempre si el cliente
    // abandona el checkout.
    paymentExpiryMinutes: toInt('ORDER_EXPIRY_MINUTES', process.env.ORDER_EXPIRY_MINUTES, 30),
    // El ganador de una subasta puede no estar conectado al cierre: tiene más margen que una compra directa.
    auctionPaymentHours: toInt('AUCTION_ORDER_EXPIRY_HOURS', process.env.AUCTION_ORDER_EXPIRY_HOURS, 48),
  },
} as const;

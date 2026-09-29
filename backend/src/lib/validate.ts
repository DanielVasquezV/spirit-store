import { AppError } from '../middleware/error-handler.js';

// Indexados por campo porque la app los pinta debajo de cada input; un solo
// texto plano obligaría a la pantalla a adivinar a qué campo corresponde.
export type FieldErrors = Record<string, string>;

export class Validator {
  private readonly errors: FieldErrors = {};

  add(field: string, message: string): this {
    // Gana el primero: no acumular mensajes del mismo campo.
    this.errors[field] ??= message;
    return this;
  }

  get isValid(): boolean {
    return Object.keys(this.errors).length === 0;
  }

  /** Lanza un 400 con el detalle por campo si hubo errores. Sin errores, no hace nada. */
  assert(): void {
    if (!this.isValid) {
      throw AppError.badRequest('Validation failed', this.errors);
    }
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Más permisiva que la del formulario del cliente a propósito: si la API
// rechazara algo que la app ya aceptó, el error aparece como un fallo invisible
// al tocar "Continuar". Admite paréntesis y hasta 25 caracteres.
const PHONE_RE = /^[+\d(][\d\s()+-]{5,24}$/;

export const RULES = {
  email: EMAIL_RE,
  phone: PHONE_RE,
  minPasswordLength: 8,
  minFullNameLength: 3,
} as const;

// `req.body` es `any` en Express, así que sin esto un string o un array pasan el
// typecheck y revientan más abajo con un error incomprensible.
export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw AppError.badRequest('Request body must be a JSON object');
  }
  return value as Record<string, unknown>;
}

export function readString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Numero opcional. `undefined` cuando la clave no vino (un PATCH parcial no debe
 * inventar un cero), error de campo cuando vino algo que no es numero. Se
 * distingue de `Number(v)`, que convierte `""` en 0 y `"abc"` en NaN en
 * silencio: los dos terminarian guardados como precio.
 */
export function readNumber(body: Record<string, unknown>, field: string): number | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw AppError.badRequest('Validation failed', { [field]: `${field} debe ser un numero` });
  }
  return value;
}

export function readInteger(body: Record<string, unknown>, field: string): number | undefined {
  const value = readNumber(body, field);
  if (value === undefined) return undefined;
  if (!Number.isInteger(value)) {
    throw AppError.badRequest('Validation failed', { [field]: `${field} debe ser un entero` });
  }
  return value;
}

/** Lista blanca. Evita que un typo (`"AUTOMATIC"`) llegue crudo a Prisma y salga como 500. */
export function readEnum<T extends string>(
  body: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw AppError.badRequest('Validation failed', {
      [field]: `${field} debe ser uno de: ${allowed.join(', ')}`,
    });
  }
  return value as T;
}

/** Fecha ISO 8601. Prisma acepta strings, pero una mal escrita entra igual hasta reventar. */
export function readDate(body: Record<string, unknown>, field: string): Date | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw AppError.badRequest('Validation failed', { [field]: `${field} debe ser una fecha ISO 8601` });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw AppError.badRequest('Validation failed', { [field]: `${field} no es una fecha valida` });
  }
  return date;
}

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

// Tope de 100: sin el, `?pageSize=100000` obliga a la base a materializar el
// catalogo entero y el endpoint se convierte en un DoS de un solo request.
export function parsePagination(query: Record<string, unknown>): Pagination {
  const raw = (value: unknown, fallback: number): number => {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw AppError.badRequest('Validation failed', {
        page: 'page y pageSize deben ser enteros positivos',
      });
    }
    return parsed;
  };

  const page = raw(query['page'], 1);
  const pageSize = Math.min(raw(query['pageSize'], 20), 100);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** Lee un query param que puede venir repetido; Express entrega un array en ese caso. */
export function readQueryString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim() || undefined;
  return undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Las columnas id son `@db.Uuid`: mandar "abc" no da un 404 limpio, Postgres lo
// rechaza con un error de datos que sale como 500. Se valida antes de consultar.
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function requireUuid(value: string, field = 'id'): string {
  if (!isUuid(value)) {
    throw AppError.badRequest('Validation failed', { [field]: `${field} debe ser un UUID valido` });
  }
  return value;
}

/** Valida el correo. Devuelve '' si no hay error. */
export function validateEmail(email: string): string {
  if (!email) return 'El correo electrónico es obligatorio';
  if (email.length > 254) return 'El correo electrónico es demasiado largo';
  return EMAIL_RE.test(email) ? '' : 'Ingresá un correo electrónico válido';
}

// `required` separa los dos usos: el alta, donde la app siempre lo pide, y el
// PATCH parcial, donde no mandar la clave significa "no lo toques". Sin ese
// parámetro un `phone: ""` pasaba y creaba cuentas sin teléfono, que después no
// se pueden contactar porque el contacto va por chat.
export function validatePhone(phone: string, required = false): string {
  if (!phone) return required ? 'El número de teléfono es obligatorio' : '';
  return PHONE_RE.test(phone) ? '' : 'Ingresá un número de teléfono válido';
}

export function validatePassword(password: string): string {
  if (!password) return 'La contraseña es obligatoria';
  if (password.length < RULES.minPasswordLength) {
    return `La contraseña debe tener al menos ${RULES.minPasswordLength} caracteres`;
  }
  // Tope de bcrypt: 72 bytes. Más allá se trunca en silencio y dos contraseñas
  // distintas dan el mismo hash.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return 'La contraseña es demasiado larga (máximo 72 bytes)';
  }
  return '';
}

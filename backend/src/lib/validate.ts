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

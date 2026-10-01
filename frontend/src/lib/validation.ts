// Validación compartida de login y registro: una regla se cambia en un solo lugar.

export type FieldErrors = Record<string, string | undefined>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s-]{6,}$/;
const MIN_PASSWORD = 8;

export interface LoginFields {
  email: string;
  password: string;
}

export interface RegisterFields extends LoginFields {
  fullName: string;
  phone: string;
  confirm: string;
}

export function validateLogin({ email, password }: LoginFields): FieldErrors {
  const errors: FieldErrors = {};
  if (!EMAIL_RE.test(email.trim())) errors.email = 'Escribí un correo válido.';
  if (password.length < MIN_PASSWORD) errors.password = `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`;
  return errors;
}

export function validateRegister({ fullName, email, phone, password, confirm }: RegisterFields): FieldErrors {
  const errors = validateLogin({ email, password });
  if (fullName.trim().length < 3) errors.fullName = 'Escribí tu nombre completo.';
  if (!PHONE_RE.test(phone.trim())) errors.phone = 'Escribí un teléfono válido.';
  if (confirm !== password) errors.confirm = 'Las contraseñas no coinciden.';
  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
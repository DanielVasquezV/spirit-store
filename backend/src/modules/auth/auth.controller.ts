import type { Request, Response } from 'express';

import { isOwnStorageUrl } from '../../config/storage.js';
import { AppError, asyncHandler } from '../../middleware/error-handler.js';
import { created, ok } from '../../lib/api-response.js';
import {
  asRecord,
  readString,
  RULES,
  validateEmail,
  validatePassword,
  validatePhone,
  Validator,
} from '../../lib/validate.js';
import * as authService from './auth.service.js';

// `phone` es como lo llama el formulario de la app; se acepta para no tener que
// tocarlo mientras el resto de la API usa phoneNumber.
function readPhoneNumber(body: Record<string, unknown>): string {
  return readString(body, 'phoneNumber') || readString(body, 'phone');
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = asRecord(req.body);
  const email = readString(body, 'email').toLowerCase();
  const fullName = readString(body, 'fullName');
  const phoneNumber = readPhoneNumber(body);
  const password = typeof body['password'] === 'string' ? body['password'] : '';

  const validator = new Validator();
  const emailError = validateEmail(email);
  if (emailError) validator.add('email', emailError);
  // Obligatorio en el alta: el formulario lo pide y el contacto va por chat, así
  // que una cuenta sin teléfono no sirve.
  const phoneError = validatePhone(phoneNumber, true);
  if (phoneError) validator.add('phone', phoneError);
  const passwordError = validatePassword(password);
  if (passwordError) validator.add('password', passwordError);
  if (fullName.length < RULES.minFullNameLength) {
    validator.add('fullName', `Ingresá tu nombre completo (mínimo ${RULES.minFullNameLength} caracteres)`);
  }
  validator.assert();

  // El rol no se toma del body: lo fija el service. Aceptarlo sería una vía de
  // autoasignación de ADMIN.
  const session = await authService.register({
    email,
    fullName,
    password,
    phoneNumber,
  });

  // El token viene en el cuerpo para que la app pueda seguir sin un segundo
  // round-trip a /login.
  created(res, session);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = asRecord(req.body);
  const email = readString(body, 'email').toLowerCase();
  const password = typeof body['password'] === 'string' ? body['password'] : '';

  const validator = new Validator();
  const emailError = validateEmail(email);
  if (emailError) validator.add('email', emailError);
  const passwordError = validatePassword(password);
  if (passwordError) validator.add('password', passwordError);
  validator.assert();

  ok(res, await authService.login({ email, password }));
});

// req.user lo deja loadUser, que ya verificó que la cuenta siga existiendo y
// activa.
export const me = asyncHandler(async (req: Request, res: Response) => {
  ok(res, req.user!);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const body = asRecord(req.body);
  const validator = new Validator();

  const fullName = readString(body, 'fullName');
  if (body['fullName'] !== undefined && fullName.length < RULES.minFullNameLength) {
    validator.add(
      'fullName',
      `Ingresá tu nombre completo (mínimo ${RULES.minFullNameLength} caracteres)`,
    );
  }

  const phoneNumber = readPhoneNumber(body);
  if (body['phoneNumber'] !== undefined || body['phone'] !== undefined) {
    // Si la clave viene tiene que traer un teléfono válido: dejarla en null
    // rompería el contacto por chat.
    const phoneError = validatePhone(phoneNumber, true);
    if (phoneError) validator.add('phone', phoneError);
  }

  // Solo URLs del bucket propio: evita apuntar el DUI a un host arbitrario.
  const duiPhotoUrl = readString(body, 'duiPhotoUrl');
  if (duiPhotoUrl && !isOwnStorageUrl(duiPhotoUrl)) {
    validator.add('duiPhotoUrl', 'La URL del DUI debe venir del almacenamiento de la app');
  }

  // Solo BUYER y SELLER: el usuario elige si compra, vende o ambas. ADMIN queda
  // fuera a propósito, o cualquiera se autoascendería con un PATCH.
  const role = readString(body, 'role');
  if (role) {
    if (role === 'ADMIN') {
      throw AppError.forbidden('El rol ADMIN no se puede autogenerar desde el perfil');
    }
    if (role !== 'BUYER' && role !== 'SELLER') {
      validator.add('role', 'Rol no válido');
    }
  }
  validator.assert();

  // El id sale del token, nunca del cuerpo.
  ok(res, await authService.updateProfile(req.auth!.sub, {
    ...(body['fullName'] !== undefined ? { fullName } : {}),
    ...(body['phoneNumber'] !== undefined || body['phone'] !== undefined
      ? { phoneNumber }
      : {}),
    ...(body['duiPhotoUrl'] !== undefined ? { duiPhotoUrl: duiPhotoUrl || null } : {}),
    ...(role ? { role: role as 'BUYER' | 'SELLER' } : {}),
  }));
});

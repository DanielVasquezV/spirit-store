import bcrypt from 'bcrypt';

import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error-handler.js';
import { signAccessToken } from '../../lib/jwt.js';
import * as userService from '../user/user.service.js';
import type { SelfUser } from '../user/user.service.js';
import type { User } from '../../generated/prisma/client.js';

// Un solo mensaje para credenciales inválidas: distinguir "el correo no existe"
// de "la contraseña no coincide" convierte el login en un oracle para enumerar
// cuentas.
const CREDENTIALS_REJECTED = 'Correo o contraseña incorrectos';

// Hash de una contraseña que nadie tiene, para que el "no existe" tarde lo
// mismo que el "existe pero falla" y no se puedan enumerar correos midiendo
// milisegundos. Se calcula una vez al cargar el módulo.
const DUMMY_HASH = bcrypt.hashSync('spiritapex-timed-comparison-placeholder', env.bcrypt.saltRounds);

export interface AuthResult {
  user: SelfUser;
  accessToken: string;
  tokenType: 'Bearer';
  /** Tal cual lo espera el cliente para saber cuándo renovar. */
  expiresIn: string;
}

function issueSession(user: SelfUser): AuthResult {
  return {
    user,
    accessToken: signAccessToken({ userId: user.id, email: user.email, role: user.role }),
    tokenType: 'Bearer',
    expiresIn: env.jwt.expiresIn,
  };
}

export interface RegisterInput {
  email: string;
  fullName: string;
  password: string;
  phoneNumber?: string;
}

// El rol lo fija el servicio y nunca el cliente: si `role` fuera parte de la
// entrada, cualquiera se autoasignaría ADMIN al registrarse. La cuenta nace
// como BUYER; SELLER se cumple al publicar un vehículo con VIN, placa y DUI.
export async function register(input: RegisterInput): Promise<AuthResult> {
  const user = await userService.createUser({
    email: input.email,
    fullName: input.fullName,
    password: input.password,
    phoneNumber: input.phoneNumber,
  });
  return issueSession(user);
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await userService.findByEmailWithCredentials(input.email);

  if (!user) {
    await bcrypt.compare(input.password, DUMMY_HASH);
    throw AppError.unauthenticated(CREDENTIALS_REJECTED);
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw AppError.unauthenticated(CREDENTIALS_REJECTED);
  }

  // La contraseña se verifica antes que el estado de la cuenta: al revés, un
  // desactivado con la contraseña correcta recibe un 403 y confirma que acertó.
  if (!user.isActive) {
    throw AppError.forbidden('La cuenta está desactivada. Contacta al soporte.');
  }

  return issueSession(userService.toSelfUser(user));
}

export interface UpdateProfileInput {
  fullName?: string;
  phoneNumber?: string | null;
  duiPhotoUrl?: string | null;
  /**
   * ADMIN queda excluido a propósito: esto edita el perfil propio, e incluirlo
   * dejaría que cualquiera se autoasigne privilegios por un PATCH.
   */
  role?: Exclude<User['role'], 'ADMIN'>;
}

// El id sale del token, nunca del body: nadie edita el perfil de otro.
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<SelfUser> {
  const updated = await userService.updateSelf(userId, input);
  if (!updated) throw AppError.notFound('User');
  return updated;
}

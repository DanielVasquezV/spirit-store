import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { AppError } from '../middleware/error-handler.js';
import type { Role } from '../generated/prisma/client.js';

/** Claims del access token. El cliente no debería poder ampliarlos. */
export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface SignTokenInput {
  userId: string;
  email: string;
  role: Role;
}

const ISSUER = 'spiritapex-api';

export function signAccessToken(input: SignTokenInput): string {
  const options: jwt.SignOptions = {
    subject: input.userId,
    expiresIn: env.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    issuer: ISSUER,
  };
  return jwt.sign({ email: input.email, role: input.role }, env.jwt.secret, options);
}

// Cualquier fallo (caducado, firma inválida, issuer distinto) sale como 401
// porque al cliente solo le alcanza con saber que tiene que refrescar.
export function verifyAccessToken(token: string): AuthTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwt.secret, { issuer: ISSUER });
    if (typeof decoded === 'string') {
      throw AppError.unauthenticated('Malformed token payload');
    }
    const { sub, email, role } = decoded as jwt.JwtPayload & Partial<AuthTokenPayload>;
    if (typeof sub !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
      throw AppError.unauthenticated('Incomplete token payload');
    }
    return { sub, email, role: role as Role };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthenticated('Invalid or expired token');
  }
}

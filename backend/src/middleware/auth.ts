import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError, asyncHandler } from './error-handler.js';
import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/jwt.js';
import type { AuthTokenPayload } from '../lib/jwt.js';
import { toSelfUser } from '../modules/user/user.service.js';
import type { Role } from '../generated/prisma/client.js';
import type { SelfUser } from '../modules/user/user.service.js';

// Claims del token, disponibles sin tocar la base.
export type AuthContext = AuthTokenPayload;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      /** Vista saneada del usuario: nunca contiene `passwordHash`. */
      user?: SelfUser;
    }
  }
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

// Rellena req.auth y sigue; no bloquea. El bloqueo es de requireAuth, así las
// rutas públicas pueden aplicar el middleware sin ramificar.
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = readBearerToken(req);
  if (token) {
    try {
      req.auth = verifyAccessToken(token);
    } catch (err) {
      return next(err);
    }
  }
  next();
};

/** Exige sesión válida. Va en toda ruta que toque datos del usuario. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(AppError.unauthenticated());
  next();
};

// Refresca el usuario desde la base: el token puede tener horas y el rol o el
// isActive haber cambiado. Proyecta con toSelfUser porque el registro crudo trae
// passwordHash, y un res.json(req.user) sin proyectar lo filtraría.
export const loadUser: RequestHandler = asyncHandler(async (req, _res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user) throw AppError.unauthenticated('Account no longer exists');
  if (!user.isActive) throw AppError.forbidden('Account is deactivated');
  req.user = toSelfUser(user);
  next();
});

// Va después de requireAuth. ADMIN no queda excluido: la moderación también
// toca recursos de BUYER y SELLER.
export function requireRole(...allowed: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.auth?.role;
    if (!role) return next(AppError.unauthenticated());
    if (role !== 'ADMIN' && !allowed.includes(role)) {
      return next(AppError.forbidden(`Requires one of: ${allowed.join(', ')}`));
    }
    next();
  };
}

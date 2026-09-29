import type { Request, Response } from 'express';

import { AppError, asyncHandler } from '../../middleware/error-handler.js';
import { created, ok } from '../../lib/api-response.js';
import { validatePassword } from '../../lib/validate.js';
import * as userService from './user.service.js';

export const getUsers = asyncHandler(async (_req: Request, res: Response) => {
  ok(res, await userService.listUsers());
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(String(req.params.id));
  if (!user) throw AppError.notFound('User');
  ok(res, user);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, fullName, password, phoneNumber } = req.body as Record<string, unknown>;

  if (typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string') {
    throw AppError.badRequest('Fields email, fullName and password are required');
  }

  // validatePassword y no un `length < 8` propio: además del mínimo, chequea el
  // tope de 72 bytes de bcrypt, más allá del cual trunca en silencio y dos
  // contraseñas distintas dan el mismo hash.
  // validatePassword y no un `length < 8` propio: además del mínimo, chequea el
  // tope de 72 bytes de bcrypt, más allá del cual trunca en silencio y dos
  // contraseñas distintas dan el mismo hash.
  const passwordError = validatePassword(password);
  if (passwordError) throw AppError.badRequest(passwordError);

  created(
    res,
    await userService.createUser({
      email,
      fullName,
      password,
      ...(typeof phoneNumber === 'string' ? { phoneNumber } : {}),
    }),
  );
});

import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../middleware/error-handler.js';
import * as userService from './user.service.js';

export async function getUsers(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json(await userService.listUsers());
  } catch (err) {
    next(err);
  }
}

export async function getUserById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await userService.getUserById(String(req.params.id));
    if (!user) throw new AppError(404, 'User not found');
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email, name, password } = req.body;

    if (!email || !password) {
      throw new AppError(400, 'Fields email and password are required');
    }

    const user = await userService.createUser({ email, name, password });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}
import { prisma } from '../../lib/prisma.js';
import type { Role, User } from '../../generated/prisma/client.js';

export type PublicUser = Omit<User, 'password'>;

export function toPublicUser(user: User): PublicUser {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

export async function listUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return users.map(toPublicUser);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}

export async function createUser(data: {
  email: string;
  name?: string;
  password: string;
  role?: Role;
}): Promise<PublicUser> {
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      password: data.password,
      role: data.role,
    },
  });
  return toPublicUser(user);
}
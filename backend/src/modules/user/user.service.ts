import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error-handler.js';
import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcrypt';
import type { Role, User } from '../../generated/prisma/client.js';

// Lo que ve cualquiera: sin hash, sin DUI y sin teléfono. En un marketplace el
// contacto va por chat, no exponiendo el número de cualquiera que mire un perfil.
export type PublicUser = Omit<User, 'passwordHash' | 'duiPhotoUrl' | 'phoneNumber'>;

// El propio usuario sí ve su DUI y su teléfono. Tipo aparte para que un listado
// no termine devolver datos privados por error.
export type SelfUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  const {
    passwordHash: _passwordHash,
    duiPhotoUrl: _duiPhotoUrl,
    phoneNumber: _phoneNumber,
    ...publicUser
  } = user;
  return publicUser;
}

export function toSelfUser(user: User): SelfUser {
  const { passwordHash: _passwordHash, ...selfUser } = user;
  return selfUser;
}

// Único punto de la app que selecciona passwordHash; el resto trabaja con
// PublicUser/SelfUser, que ya lo excluyen. Normaliza el correo igual que
// createUser para que el login acepte las mismas claves que guardó el registro.
export function findByEmailWithCredentials(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
}

export async function findById(id: string): Promise<SelfUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toSelfUser(user) : null;
}

// id, email, passwordHash e isActive quedan fuera a propósito: son la vía
// directa a tomar control de otra cuenta.
export interface UpdateSelfInput {
  fullName?: string;
  phoneNumber?: string | null;
  duiPhotoUrl?: string | null;
  role?: Role;
}

export async function updateSelf(id: string, input: UpdateSelfInput): Promise<SelfUser | null> {
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {}),
      // Proyecto de prueba sin revisión manual: cargar el DUI lo verifica en el acto; quitarlo vuelve a NONE.
      ...(input.duiPhotoUrl !== undefined
        ? {
            duiPhotoUrl: input.duiPhotoUrl,
            duiStatus: input.duiPhotoUrl ? 'VERIFIED' : 'NONE',
            duiVerifiedAt: input.duiPhotoUrl ? new Date() : null,
          }
        : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
    },
  });
  return toSelfUser(user);
}

export async function listUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return users.map(toPublicUser);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  password: string;
  phoneNumber?: string;
  role?: Role;
}

// Devuelve la vista del propio usuario: quien se da de alta es el dueño de la
// cuenta y necesita leer sus campos.
export async function createUser(input: CreateUserInput): Promise<SelfUser> {
  // La unicidad de la columna es case-sensitive en Postgres, así que
  // A@x.com y a@x.com tienen que caer en la misma fila.
  const email = input.email.trim().toLowerCase();

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw AppError.conflict('Email is already registered');

  const passwordHash = await bcrypt.hash(input.password, env.bcrypt.saltRounds);

  const user = await prisma.user.create({
    data: {
      email,
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      passwordHash,
      role: input.role,
    },
  });

  return toSelfUser(user);
}

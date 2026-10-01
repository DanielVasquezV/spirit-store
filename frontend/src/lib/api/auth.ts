import { http } from './http-client';
import type { AuthResult, SelfUser } from '@/lib/types/api';

export interface RegisterInput {
  email: string;
  fullName: string;
  password: string;
  phoneNumber?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  phoneNumber?: string | null;
}

export function register(input: RegisterInput): Promise<AuthResult> {
  return http.post<AuthResult>('/auth/register', input);
}

export function login(input: LoginInput): Promise<AuthResult> {
  return http.post<AuthResult>('/auth/login', input);
}

export function me(): Promise<SelfUser> {
  return http.get<SelfUser>('/auth/me');
}

export function updateMe(input: UpdateProfileInput): Promise<SelfUser> {
  return http.patch<SelfUser>('/auth/me', input);
}
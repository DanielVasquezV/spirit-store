import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '@/lib/api/auth';
import { clearAccessToken, getAccessToken, setAccessToken } from '@/lib/api/auth-token-store';
import { isApiError } from '@/lib/api/api-error';
import { setUnauthorizedHandler } from '@/lib/api/http-client';
import { connectSocket, disconnectSocket } from '@/lib/api/socket-client';
import type { LoginInput, RegisterInput, UpdateProfileInput } from '@/lib/api/auth';
import type { AuthResult, SelfUser } from '@/lib/types/api';

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface SessionValue {
  status: SessionStatus;
  user: SelfUser | null;
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const RESTORE_ATTEMPTS = 3;
const RESTORE_RETRY_MS = 1500;

// Un reinicio del servidor o un corte de red al abrir la app no debe cerrar la sesión: se reintenta antes de rendirse.
async function restoreProfile(): Promise<SelfUser> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await authApi.me();
    } catch (error) {
      const retryable = !isApiError(error) || error.status === 0 || error.status >= 500;
      if (!retryable || attempt >= RESTORE_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, RESTORE_RETRY_MS));
    }
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<SelfUser | null>(null);

  const signOut = useCallback(async () => {
    await clearAccessToken();
    disconnectSocket();
    // La caché puede tener datos privados de la cuenta que termina de salir.
    queryClient.clear();
    setUser(null);
    setStatus('anonymous');
  }, [queryClient]);

  const statusRef = useRef<SessionStatus>('loading');
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      // Sin sesión activa un 401 es esperable: cerrar sesión otra vez vaciaría la caché y repetiría los requests en bucle.
      if (statusRef.current === 'authenticated') void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  useEffect(() => {
    let active = true;
    // El token en el storage decide si hay sesión: sin token no se toca la red.
    void (async () => {
      const token = await getAccessToken();
      if (!token) {
        if (active) setStatus('anonymous');
        return;
      }
      try {
        const profile = await restoreProfile();
        if (!active) return;
        setUser(profile);
        setStatus('authenticated');
        void connectSocket();
      } catch (error) {
        // Solo un 401 invalida el token: con la API caída se conserva y el próximo arranque reintenta.
        if (isApiError(error) && error.status === 401) await clearAccessToken();
        if (active) setStatus('anonymous');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const adoptSession = useCallback((result: AuthResult) => {
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const signIn = useCallback(
    async (input: LoginInput) => {
      const result = await authApi.login(input);
      await setAccessToken(result.accessToken);
      adoptSession(result);
      void connectSocket();
    },
    [adoptSession],
  );

  const signUp = useCallback(
    async (input: RegisterInput) => {
      const result = await authApi.register(input);
      await setAccessToken(result.accessToken);
      adoptSession(result);
      void connectSocket();
    },
    [adoptSession],
  );

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    setUser(await authApi.updateMe(input));
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ status, user, signIn, signUp, signOut, updateProfile }),
    [status, user, signIn, signUp, signOut, updateProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de SessionProvider');
  return value;
}
// Las consultas privadas se habilitan con esto: así una pantalla abierta como invitado no dispara 401.
export function useIsAuthenticated(): boolean {
  return useSession().status === 'authenticated';
}

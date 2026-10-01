import { router } from 'expo-router';
import { useCallback } from 'react';
import { useSession } from './session-provider';

// Las vistas son públicas y las acciones no: sin sesión se va al login y, al volver, el usuario repite la acción.
export function useRequireAuth() {
  const { status } = useSession();
  const isGuest = status !== 'authenticated';

  const requireAuth = useCallback(
    (action: () => void) => {
      if (isGuest) router.push('/login');
      else action();
    },
    [isGuest],
  );

  return { isGuest, requireAuth };
}

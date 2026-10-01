import { router, useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { useSession } from '@/features/auth/session-provider';

// Pantallas que no tienen sentido sin cuenta; el resto se puede ver como invitado y protege solo sus acciones.
const PRIVATE_ROOTS = new Set(['chat', 'checkout', 'purchase', 'purchases', 'vehicle', 'my-vehicles', 'my-bids', 'profile-edit']);

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const root = useSegments()[0] ?? '';

  useEffect(() => {
    // Efecto y no <Redirect>: el Stack tiene que seguir montado o expo-router navega antes del layout raíz.
    if (status === 'anonymous' && PRIVATE_ROOTS.has(root)) router.replace('/login');
  }, [status, root]);

  return <>{children}</>;
}

import type { ReactNode } from 'react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/api-error';

type ShouldRetry = (failureCount: number, error: unknown) => boolean;

// Un 4xx no mejora reintentando: solo tiene sentido reintentar fallos de red o del servidor.
const shouldRetry: ShouldRetry = (failureCount, error) => {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
};

export function AppQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: false },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
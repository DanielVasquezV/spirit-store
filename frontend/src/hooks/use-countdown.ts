import { useEffect, useState } from 'react';
import { remainingMs } from '@/lib/payment';

// Milisegundos hasta `expiresAt`, recalculados cada segundo; 0 cuando vence.
export function useCountdown(expiresAt: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return remainingMs(expiresAt ?? null, now);
}

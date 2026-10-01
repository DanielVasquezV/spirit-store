import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { auctionKeys } from '@/features/auctions/use-auctions';
import { catalogKeys } from '@/features/catalog/use-catalog';
import { subscribe } from '@/lib/api/socket-client';

// Eventos de la sala personal que invalidan datos de otras pantallas aunque no estén abiertas.
export function useRealtimeSync(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let cleanups: (() => void)[] = [];
    let cancelled = false;
    void Promise.all([
      subscribe('order:paid', () => {
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
        void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      }),
      subscribe('auction:outbid', () => void queryClient.invalidateQueries({ queryKey: auctionKeys.myBids })),
      subscribe('auction:closed', () => {
        void queryClient.invalidateQueries({ queryKey: auctionKeys.active });
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
        void queryClient.invalidateQueries({ queryKey: auctionKeys.myBids });
      }),
    ]).then((fns) => {
      if (cancelled) fns.forEach((fn) => fn());
      else cleanups = fns;
    });
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [enabled, queryClient]);
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Easing, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { auctionKeys, useAuction } from '@/features/auctions/use-auctions';
import { useSession } from '@/features/auth/session-provider';
import { catalogKeys } from '@/features/catalog/use-catalog';
import { orderKeys, usePendingPurchases } from '@/features/orders/use-orders';
import { auctionCta } from './auction-rules';
import { placeBid } from '@/lib/api/auctions';
import { messageFor } from '@/lib/api/api-error';
import { subscribe, watchAuction } from '@/lib/api/socket-client';
import type { AuctionDto, BidDto, BidPlacedEvent } from '@/lib/types/api';

export type BidEntry = { id: string; name: string; amount: number; date: Date; own: boolean };

export type AuctionStatus = 'LIVE' | 'PENDING' | 'CLOSED';

const FEED_LIMIT = 10;

function minimumNext(auction: AuctionDto): number {
  return auction.currentBid === null ? auction.startingPrice : auction.currentBid + auction.minBidIncrement;
}

// La puja que llega por socket ya trae el estado consolidado: se aplica sobre la caché sin refetch.
function applyBid(auction: AuctionDto, event: BidPlacedEvent): AuctionDto {
  if (auction.recentBids.some((bid) => bid.id === event.bid.id)) return auction;
  return {
    ...auction,
    currentBid: event.currentBid,
    bidCount: event.bidCount,
    currentWinner: event.currentWinner,
    recentBids: [event.bid, ...auction.recentBids].slice(0, FEED_LIMIT),
  };
}

function secondsUntil(iso: string | undefined, now: number): number {
  return iso ? Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000)) : 0;
}

export function useLiveAuction(auctionId: string | undefined) {
  const queryClient = useQueryClient();
  const { user, status: sessionStatus } = useSession();
  const isGuest = sessionStatus !== 'authenticated';
  const query = useAuction(auctionId, { poll: isGuest });
  const auction = query.data;
  const [now, setNow] = useState(() => Date.now());
  const [closedByServer, setClosedByServer] = useState(false);
  const progress = useSharedValue(1);
  const bump = useSharedValue(0);

  const key = auctionKeys.detail(auctionId ?? '');

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!auctionId || isGuest) return;
    let cleanups: (() => void)[] = [];
    let cancelled = false;
    void Promise.all([
      watchAuction(auctionId),
      subscribe('auction:bid-placed', (event) => {
        if (event.auctionId !== auctionId) return;
        queryClient.setQueryData<AuctionDto>(key, (current) => (current ? applyBid(current, event) : current));
        bump.value = withSequence(withTiming(1, { duration: 130 }), withSpring(0, { damping: 9 }));
      }),
      subscribe('auction:closed', (event) => {
        if (event.auctionId !== auctionId) return;
        setClosedByServer(true);
        void queryClient.invalidateQueries({ queryKey: key });
        // El cierre con ganador crea su orden pendiente: "Mis compras" tiene que verla sin recargar.
        void queryClient.invalidateQueries({ queryKey: orderKeys.all });
        void queryClient.invalidateQueries({ queryKey: auctionKeys.active });
      }),
      subscribe('auction:started', (event) => {
        if (event.auctionId === auctionId) void queryClient.invalidateQueries({ queryKey: key });
      }),
    ]).then((fns) => {
      // El efecto pudo desmontarse antes de que el socket conectara: se limpia en el acto.
      if (cancelled) fns.forEach((fn) => fn());
      else cleanups = fns;
    });
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId, isGuest, queryClient]);

  const secondsLeft = secondsUntil(auction?.endTime, now);
  const status: AuctionStatus =
    // Todo lo que no está en curso ni programado ya terminó: FINISHED, CANCELLED o CLOSED (ganador sin pago).
    !auction || closedByServer || (auction.status !== 'ACTIVE' && auction.status !== 'PENDING') || (auction.status === 'ACTIVE' && secondsLeft === 0)
      ? 'CLOSED'
      : auction.status === 'PENDING'
        ? 'PENDING'
        : 'LIVE';

  useEffect(() => {
    if (!auction) return;
    // La barra representa el tiempo restante sobre la ventana total de la subasta.
    const total = new Date(auction.endTime).getTime() - new Date(auction.startTime).getTime();
    const remainingMs = Math.max(0, new Date(auction.endTime).getTime() - Date.now());
    progress.value = total > 0 ? remainingMs / total : 0;
    progress.value = withTiming(0, { duration: remainingMs, easing: Easing.linear });
  }, [auction?.startTime, auction?.endTime, progress, auction]);

  const entries = useMemo<BidEntry[]>(
    () =>
      (auction?.recentBids ?? []).map((bid: BidDto) => ({
        id: bid.id,
        name: bid.bidder.id === user?.id ? 'Tú' : bid.bidder.fullName,
        amount: bid.amount,
        date: new Date(bid.createdAt),
        own: bid.bidder.id === user?.id,
      })),
    [auction?.recentBids, user?.id],
  );

  const mutation = useMutation({
    mutationFn: (amount: number) => placeBid(auctionId!, amount),
    onSuccess: (result) => {
      queryClient.setQueryData<AuctionDto>(key, (current) =>
        current ? { ...result.auction, recentBids: result.auction.recentBids.length ? result.auction.recentBids : [result.bid, ...current.recentBids] } : result.auction,
      );
      void queryClient.invalidateQueries({ queryKey: auctionKeys.myBids });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
    },
  });

  const nextStep = auction ? minimumNext(auction) : 0;
  const pendingPurchases = usePendingPurchases();
  const isOwner = Boolean(auction && user && auction.sellerId === user.id);
  // El backend exige el DUI para pujar: se bloquea antes de gastar el request.
  const needsDui = user?.duiStatus === 'NONE';

  const bid = useCallback(() => {
    if (status !== 'LIVE' || mutation.isPending || isOwner || needsDui || isGuest) return;
    mutation.mutate(nextStep);
  }, [status, mutation, nextStep, isOwner, needsDui, isGuest]);

  const isWinning = Boolean(auction?.currentWinner && auction.currentWinner.id === user?.id);
  // Ganada: el cierre generó una orden pendiente y el CTA pasa a ser pagarla.
  const wonOrder = status === 'CLOSED' && isWinning ? pendingPurchases.find((order) => order.vehicleId === auction?.vehicleId) : undefined;
  const cta = auctionCta({ closed: status === 'CLOSED', pending: status === 'PENDING', isGuest, isOwner, needsDui, bidding: mutation.isPending, nextStep, wonOrder });

  return {
    query,
    auction,
    cta,
    wonOrder,
    current: auction ? auction.currentBid ?? auction.startingPrice : 0,
    hasBids: Boolean(auction?.currentBid !== null && auction?.currentBid !== undefined),
    secondsLeft,
    status,
    entries,
    nextStep,
    progress,
    bump,
    bid,
    bidding: mutation.isPending,
    bidError: mutation.error ? messageFor(mutation.error, 'No pudimos registrar tu puja.') : null,
    isOwner,
    needsDui,
    isWinning,
  };
}

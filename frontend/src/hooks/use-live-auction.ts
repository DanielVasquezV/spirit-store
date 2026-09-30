import { useCallback, useEffect, useRef, useState } from 'react';
import { Easing, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { AUCTION_BIDDERS } from '@/lib/mock-data';

export type BidEntry = { id: string; name: string; amount: number; date: Date };

export type AuctionStatus = 'LIVE' | 'CLOSED';

const SIM_INTERVAL = 5000;
const ROUND_SECONDS = 300;
const MIN_STEP = 5;
const FEED_LIMIT = 3;

function randomBidder(): string {
  return AUCTION_BIDDERS[Math.floor(Math.random() * AUCTION_BIDDERS.length)];
}

// Simula participantes pujando cada 5s con incrementos de $5 o $10.
// La ronda dura 5 minutos y se extiende con cada puja; al expirar, la subasta cierra.
export function useLiveAuction(startPrice: number) {
  const [current, setCurrent] = useState(startPrice);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [status, setStatus] = useState<AuctionStatus>('LIVE');
  const [feed, setFeed] = useState<BidEntry[]>(() => [
    { id: 'seed-1', name: randomBidder(), amount: startPrice - 10, date: new Date(Date.now() - 60_000) },
    { id: 'seed-2', name: randomBidder(), amount: startPrice - 20, date: new Date(Date.now() - 180_000) },
  ]);

  const statusRef = useRef<AuctionStatus>('LIVE');
  const progress = useSharedValue(1);
  const bump = useSharedValue(0);

  // La barra se reinicia completa con cada puja: nunca queda en la mitad.
  const restartProgress = useCallback(() => {
    progress.value = 1;
    progress.value = withTiming(0, { duration: ROUND_SECONDS * 1000, easing: Easing.linear });
  }, [progress]);

  const pushBid = useCallback(
    (name: string, amount: number) => {
      setFeed((items) => [{ id: `bid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, amount, date: new Date() }, ...items].slice(0, FEED_LIMIT));
      bump.value = withSequence(withTiming(1, { duration: 130 }), withSpring(0, { damping: 9 }));
      restartProgress();
    },
    [bump, restartProgress],
  );

  useEffect(() => {
    restartProgress();

    const sim = setInterval(() => {
      if (statusRef.current === 'CLOSED') return;
      setCurrent((value) => {
        const next = value + (Math.random() < 0.5 ? MIN_STEP : 10);
        pushBid(randomBidder(), next);
        return next;
      });
    }, SIM_INTERVAL);

    const clock = setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          // Sin pujas por 5 minutos: la subasta se cierra y el feed se congela.
          statusRef.current = 'CLOSED';
          setStatus('CLOSED');
          clearInterval(sim);
          progress.value = 0;
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => {
      clearInterval(sim);
      clearInterval(clock);
    };
  }, [progress, pushBid, restartProgress]);

  const bid = useCallback(() => {
    if (statusRef.current === 'CLOSED') return;
    setCurrent((value) => {
      const next = value + MIN_STEP;
      pushBid('Tú', next);
      return next;
    });
  }, [pushBid]);

  return { current, secondsLeft, status, entries: feed, nextStep: current + MIN_STEP, progress, bump, bid };
}
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Avatar } from '@/components/ui/avatar';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { AUCTION_BIDDERS, getProductById } from '@/lib/mock-data';
import { formatPriceParts } from '@/lib/format';

type Participant = { name: string; amount: number };

type AuctionCardProps = {
  vehicleId: string;
  startPrice: number;
};

// mm:ss local del contador (máx. 60s, por eso no hace falta horas).
function formatClock(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function makeParticipant(amount: number): Participant {
  // Participante aleatorio para simular a otros usuarios pujando en vivo.
  const name = AUCTION_BIDDERS[Math.floor(Math.random() * AUCTION_BIDDERS.length)];
  return { name, amount };
}

export function AuctionCard({ vehicleId, startPrice }: AuctionCardProps) {
  const product = getProductById(vehicleId);
  const [current, setCurrent] = useState(startPrice);
  const [feed, setFeed] = useState<Participant[]>(() => [makeParticipant(startPrice)]);
  const [lastTime, setLastTime] = useState('01:00');
  const secondsRef = useRef(60);

  useEffect(() => {
    // Acá vive la simulación: cada 5s puja un participante aleatorio.
    const auction = setInterval(() => {
      setCurrent((value) => {
        const delta = Math.random() < 0.5 ? 5 : 10;
        const next = value + delta;
        setFeed((items) => [makeParticipant(next), ...items].slice(0, 5));
        return next;
      });
    }, 5000);

    const countdown = setInterval(() => {
      secondsRef.current = Math.max(0, secondsRef.current - 1);
      setLastTime(formatClock(secondsRef.current));
    }, 1000);

    return () => {
      clearInterval(auction);
      clearInterval(countdown);
    };
  }, []);

  const bid = () => {
    // La oferta propia resetea la cuenta regresiva pero la subasta sigue viva.
    setCurrent((value) => value + 5);
    setFeed((items) => [{ name: 'Tú', amount: 5 }, ...items].slice(0, 5));
    secondsRef.current = 60;
    setLastTime(formatClock(60));
  };

  if (!product) return null;

  const { whole, cents } = formatPriceParts(current);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{product.title}</Text>
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>En vivo</Text>
        </View>
      </View>

      <View style={styles.bidRow}>
        <View>
          <Text style={styles.bidLabel}>Puja actual</Text>
          <Text style={styles.bidValue}>
            {whole}
            <Text style={styles.bidCents}>.{cents}</Text>
          </Text>
        </View>
        <Text style={styles.timer}>{lastTime}</Text>
      </View>

      <View style={styles.feed}>
        <Text style={styles.feedTitle}>Participantes recientes</Text>
        {feed.map((participant, index) => (
          <View key={index} style={styles.participant}>
            <Avatar name={participant.name} size={28} />
            <Text style={[styles.participantName, participant.name === 'Tú' && styles.participantSelf]}>{participant.name}</Text>
            <Text style={styles.participantAmount}>${formatPriceParts(participant.amount).whole}</Text>
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={bid}
        style={({ pressed }) => [styles.bidButton, pressed && styles.bidPressed]}>
        <Feather name="zap" size={18} color={Colors.textInverse} />
        <Text style={styles.bidButtonLabel}>Pujar (+ $5.00)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
    padding: Layout.cardPadding,
    gap: Spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  title: { flex: 1, ...Type.h3, color: Colors.text },
  live: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.overlay },
  liveDot: { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Colors.success },
  liveText: { ...Type.labelSm, color: Colors.success },
  bidRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  bidLabel: { ...Type.labelSm, color: Colors.textMuted },
  bidValue: { ...Type.priceHero, color: Colors.text },
  bidCents: { ...Type.priceCentsHero, color: Colors.text },
  timer: { ...Type.bodyStrong, color: Colors.textMuted },
  feed: { gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.sm },
  feedTitle: { ...Type.labelSm, color: Colors.textMuted, marginBottom: Spacing.xs },
  participant: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  participantName: { flex: 1, ...Type.bodySm, color: Colors.textSecondary },
  participantSelf: { color: Colors.text },
  participantAmount: { ...Type.bodyStrong, color: Colors.text },
  bidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accent,
  },
  bidPressed: { backgroundColor: Colors.accentPressed },
  bidButtonLabel: { ...Type.label, color: Colors.textInverse },
});
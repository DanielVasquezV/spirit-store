import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { PhotoGallery } from '@/components/photo-gallery';
import { DetailSkeleton } from '@/components/state-view';
import { useLiveAuction, type BidEntry } from '@/features/auctions/use-live-auction';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { StickyCta } from '@/components/ui/sticky-cta';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { isNotFound } from '@/lib/api/api-error';
import { formatBidStamp, formatClock, formatPriceParts } from '@/lib/format';

const COIN = require('../../../assets/sounds/coin.wav');

function BidRow({ entry }: { entry: BidEntry }) {
  const enter = useSharedValue(0);
  const own = entry.own;

  useEffect(() => {
    // Cada fila nueva entra con rebote: es la señal visual de una puja recién caída.
    enter.value = 0;
    enter.value = withSpring(1, { damping: 11, stiffness: 180 });
  }, [enter]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 10 }, { scale: 0.94 + enter.value * 0.06 }],
  }));

  return (
    <Animated.View style={[styles.bidRow, style]}>
      <Avatar name={entry.name} size={32} />
      <View style={styles.bidInfo}>
        <Text style={[styles.bidName, own && styles.bidNameOwn]}>{entry.name}</Text>
        <Text style={styles.bidTime}>{formatBidStamp(entry.date)}</Text>
      </View>
      <Text style={styles.bidAmount}>${formatPriceParts(entry.amount).whole}</Text>
    </Animated.View>
  );
}

export default function AuctionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const live = useLiveAuction(id);
  const { auction, query, current, secondsLeft, status, entries, nextStep, progress, bump, bid } = live;
  const coin = useAudioPlayer(COIN);
  const topBidId = entries[0]?.id;
  const firstRender = useRef(true);

  useEffect(() => {
    // El primer valor llega con la carga inicial: la moneda solo suena con pujas posteriores.
    if (firstRender.current) {
      if (topBidId) firstRender.current = false;
      return;
    }
    // El catch evita ruido si el player todavía no terminó de cargar el asset.
    void coin.seekTo(0).then(() => coin.play()).catch(() => {});
  }, [topBidId, coin]);

  const priceStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + bump.value * 0.07 }] }));

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(progress.value, 0) * 100}%`,
    backgroundColor: interpolateColor(progress.value, [0, 0.2, 0.6, 1], [Colors.danger, Colors.warning, Colors.success, Colors.accent]),
  }));

  if (query.isPending) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Subasta" onBack={() => router.back()} />
        <DetailSkeleton />
      </View>
    );
  }

  if (!auction) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>{query.isError && !isNotFound(query.error) ? 'No pudimos cargar la subasta' : 'Subasta no encontrada'}</Text>
        {query.isError && !isNotFound(query.error) ? <Button label="Reintentar" size="sm" variant="secondary" onPress={() => void query.refetch()} /> : null}
        <Button label="Volver" size="sm" onPress={() => router.back()} />
      </View>
    );
  }

  const product = auction.vehicle;
  const closed = status === 'CLOSED';

  const pending = status === 'PENDING';

  const onBid = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    bid();
  };

  const onCta = () => {
    if (live.cta.action === 'pay' && live.wonOrder) router.push(`/checkout/${live.wonOrder.id}`);
    else if (live.cta.action === 'sign-in') router.push('/login');
    else if (live.cta.action === 'upload-dui') router.push('/profile');
    else if (live.cta.action === 'bid') onBid();
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title={product.model} subtitle={product.brand} onBack={() => router.back()} />

      <Animated.ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Layout.ctaBarHeight + Spacing.xl }]}
        showsVerticalScrollIndicator={false}>
        <PhotoGallery images={product.images.map((image) => image.url)} />

        <View style={styles.liveCard}>
          <View style={styles.liveTop}>
            {closed ? (
              <View style={[styles.pill, styles.pillClosed]}>
                <View style={[styles.pillDot, { backgroundColor: Colors.danger }]} />
                <Text style={[styles.pillText, { color: Colors.danger }]}>Cerrada</Text>
              </View>
            ) : (
              <View style={styles.pill}>
                <View style={[styles.pillDot, pending && { backgroundColor: Colors.warning }]} />
                <Text style={[styles.pillText, pending && { color: Colors.warning }]}>{pending ? 'Próximamente' : 'En vivo'}</Text>
              </View>
            )}

            <View style={styles.timer}>
              <Text style={styles.timerText}>{closed ? (auction.status === 'CLOSED' ? 'Sin pago' : 'Finalizada') : pending ? 'Programada' : formatClock(secondsLeft)}</Text>
            </View>
          </View>

          {/* Barra de tiempo: se vacía solo y se reinicia con cada puja. */}
          <View style={styles.timeTrack}>
            <Animated.View style={[styles.timeBar, barStyle]} />
          </View>

          <Animated.View style={priceStyle}>
            <Price amount={current} variant="hero" caption={closed ? 'Precio final' : live.hasBids ? 'Puja actual' : 'Puja inicial'} />
          </Animated.View>

          {closed ? null : (
            <View style={styles.nextRow}>
              <Text style={styles.nextLabel}>Mínimo siguiente</Text>
              <Text style={styles.nextValue}>${formatPriceParts(nextStep).whole}</Text>
            </View>
          )}

          {auction.status === 'CLOSED' ? (
            <Text style={styles.bidError}>El ganador no pagó a tiempo: la subasta quedó cerrada sin venta.</Text>
          ) : live.isWinning ? (
            <Text style={styles.winning}>{closed ? 'Ganaste esta subasta' : 'Vas ganando esta subasta'}</Text>
          ) : null}
          {live.needsDui && !closed ? <Text style={styles.bidError}>Para pujar necesitás cargar tu DUI en el perfil.</Text> : null}
          {live.bidError ? <Text style={styles.bidError}>{live.bidError}</Text> : null}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Últimas pujas" count={`${auction.bidCount}`} />
          {entries.length > 0 ? (
            <View style={styles.feed}>
              {entries.map((entry) => (
                <BidRow key={entry.id} entry={entry} />
              ))}
            </View>
          ) : (
            <Text style={styles.noBids}>Todavía nadie pujó. La primera puja arranca en el precio de salida.</Text>
          )}
        </View>
      </Animated.ScrollView>

      <StickyCta>
        <Button
          label={live.cta.label}
          fullWidth
          size="lg"
          disabled={live.cta.disabled}
          onPress={onCta}
        />
      </StickyCta>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.md },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  missingText: { ...Type.h2, color: Colors.text },
  liveCard: {
    gap: Spacing.lg,
    padding: Layout.cardPadding,
    marginTop: Spacing.xl,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  liveTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.overlay,
  },
  pillClosed: { backgroundColor: Colors.overlay },
  pillDot: { width: 8, height: 8, borderRadius: Radius.full, backgroundColor: Colors.success },
  pillText: { ...Type.labelSm, color: Colors.success },
  timer: { alignItems: 'flex-end' },
  timerText: { ...Type.h3, color: Colors.text, fontVariant: ['tabular-nums'] },
  timeTrack: { height: 4, borderRadius: Radius.full, backgroundColor: Colors.overlay, overflow: 'hidden' },
  timeBar: { height: '100%', borderRadius: Radius.full },
  nextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextLabel: { ...Type.caption, color: Colors.textMuted },
  nextValue: { ...Type.bodyStrong, color: Colors.text },
  section: { gap: Spacing.md, marginTop: Spacing.xxl },
  feed: {
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  bidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: Hairline,
    borderBottomColor: Colors.border,
  },
  bidInfo: { flex: 1, gap: 2 },
  bidName: { ...Type.body, color: Colors.textSecondary },
  bidNameOwn: { ...Type.bodyStrong, color: Colors.text },
  bidTime: { ...Type.caption, color: Colors.textMuted },
  bidAmount: { ...Type.bodyStrong, color: Colors.text },
  winning: { ...Type.label, color: Colors.success },
  bidError: { ...Type.caption, color: Colors.danger },
  noBids: { ...Type.body, color: Colors.textMuted },
});

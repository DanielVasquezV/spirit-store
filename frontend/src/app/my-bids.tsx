import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { StateView } from '@/components/state-view';
import { Badge } from '@/components/ui/badge';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { isLeadingBid, latestBidPerAuction } from '@/features/auctions/auction-rules';
import { useMyBids } from '@/features/auctions/use-auctions';
import { flattenPages } from '@/features/catalog/use-catalog';
import { formatBidStamp, formatPriceParts } from '@/lib/format';
import { AUCTION_STATUS_LABELS } from '@/lib/taxonomy';

export default function MyBidsScreen() {
  const bids = useMyBids();
  const items = latestBidPerAuction(flattenPages(bids.data?.pages));

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader title="Subastas seguidas" onBack={() => router.back()} />
      <FlatList
        data={items}
        keyExtractor={(bid) => bid.auction.id}
        renderItem={({ item }) => {
          const leading = isLeadingBid(item);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/auction/${item.auction.id}`)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.info}>
                <Text style={styles.title}>Tu puja ${formatPriceParts(item.amount).whole}</Text>
                <Text style={styles.meta}>
                  {formatBidStamp(new Date(item.createdAt))} · Actual ${formatPriceParts(item.auction.currentBid ?? item.amount).whole}
                </Text>
              </View>
              <Badge label={item.auction.status === 'ACTIVE' ? (leading ? 'Vas ganando' : 'Superada') : AUCTION_STATUS_LABELS[item.auction.status]} tone={leading ? 'accent' : 'neutral'} />
              <Feather name="chevron-right" size={18} color={Colors.textMuted} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          bids.isPending ? null : bids.isError ? (
            <StateView icon="wifi-off" title="No pudimos cargar tus pujas" actionLabel="Reintentar" onAction={() => void bids.refetch()} />
          ) : (
            <StateView icon="activity" title="Sin pujas todavía" body="Las subastas en las que participes aparecen acá." actionLabel="Ver subastas" onAction={() => router.push('/auctions')} />
          )
        }
        onEndReached={() => {
          if (bids.hasNextPage && !bids.isFetchingNextPage) void bids.fetchNextPage();
        }}
        refreshControl={<RefreshControl refreshing={bids.isRefetching} onRefresh={() => void bids.refetch()} tintColor={Colors.textMuted} />}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Layout.screenX },
  separator: { height: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Layout.cardPadding,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  pressed: { backgroundColor: Colors.overlay },
  info: { flex: 1, gap: Spacing.xs },
  title: { ...Type.bodyStrong, color: Colors.text },
  meta: { ...Type.caption, color: Colors.textMuted },
});

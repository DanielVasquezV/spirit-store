import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SearchBar } from '@/components/search-bar';
import { ListFooterSkeleton, ListSkeleton, StateView } from '@/components/state-view';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { formatBidStamp, formatMoney } from '@/lib/format';
import { AUCTION_STATUS_LABELS } from '@/lib/taxonomy';
import type { AuctionHistoryItemDto, AuctionHistoryRole } from '@/lib/types/api';
import { historyHref, historyOutcome } from '../auction-rules';
import { useAuctionHistoryFilters, type HistoryRoleFilter, type HistoryStatusFilter } from '../use-auction-history-filters';

const ROLE_FILTERS: { value: HistoryRoleFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'seller', label: 'Creadas' },
  { value: 'winner', label: 'Ganadas' },
  { value: 'bidder', label: 'Participé' },
];

const STATUS_FILTERS: { value: HistoryStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'ACTIVE', label: AUCTION_STATUS_LABELS.ACTIVE },
  { value: 'PENDING', label: AUCTION_STATUS_LABELS.PENDING },
  { value: 'FINISHED', label: AUCTION_STATUS_LABELS.FINISHED },
  { value: 'CLOSED', label: AUCTION_STATUS_LABELS.CLOSED },
  { value: 'CANCELLED', label: AUCTION_STATUS_LABELS.CANCELLED },
];

const ROLE_LABELS: Record<AuctionHistoryRole, string> = { SELLER: 'Creada por vos', WINNER: 'Ganada', BIDDER: 'Pujaste' };


function HistoryRow({ item }: { item: AuctionHistoryItemDto }) {
  const result = historyOutcome(item);
  const finalPrice = item.currentBid ?? item.startingPrice;

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(historyHref(item))} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.thumb}>
        {item.vehicle.images[0]?.url ? (
          <Image source={{ uri: item.vehicle.images[0].url }} style={styles.image} contentFit="cover" />
        ) : (
          <Feather name="truck" size={22} color={Colors.borderStrong} />
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.top}>
          <Text style={styles.title} numberOfLines={1}>{item.vehicle.title}</Text>
          <Badge label={AUCTION_STATUS_LABELS[item.status]} tone={item.status === 'ACTIVE' ? 'accent' : 'neutral'} />
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {ROLE_LABELS[item.myRole]} · {item.bidCount} {item.bidCount === 1 ? 'puja' : 'pujas'} · cierra {formatBidStamp(new Date(item.endTime))}
        </Text>
        <View style={styles.prices}>
          <View>
            <Text style={styles.priceLabel}>{item.currentBid === null ? 'Precio de salida' : item.status === 'ACTIVE' ? 'Puja actual' : 'Puja final'}</Text>
            <Text style={styles.price}>{formatMoney(finalPrice)}</Text>
          </View>
          {item.myHighestBid !== null ? (
            <View style={styles.right}>
              <Text style={styles.priceLabel}>Tu puja</Text>
              <Text style={styles.price}>{formatMoney(item.myHighestBid)}</Text>
            </View>
          ) : null}
        </View>
        {result ? <Text style={[styles.outcome, { color: result.tone }]}>{result.text}</Text> : null}
      </View>
    </Pressable>
  );
}

// Registro de las subastas del usuario: las que creó y en las que pujó, con filtros por rol, estado y texto.
export function AuctionHistory({ bottomInset }: { bottomInset: number }) {
  const { query, setQuery, role, setRole, status, setStatus, reset, filtered, history, items, total } = useAuctionHistoryFilters();

  const header = (
    <View style={styles.header}>
      <SearchBar value={query} onSearch={setQuery} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {ROLE_FILTERS.map((item) => (
          <Chip key={item.value} label={item.label} selected={role === item.value} onPress={() => setRole(item.value)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_FILTERS.map((item) => (
          <Chip key={item.value} label={item.label} selected={status === item.value} onPress={() => setStatus(item.value)} />
        ))}
      </ScrollView>
      <Text style={styles.count}>{total} {total === 1 ? 'SUBASTA' : 'SUBASTAS'}</Text>
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <HistoryRow item={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        history.isPending ? (
          <ListSkeleton count={2} />
        ) : history.isError ? (
          <StateView icon="wifi-off" title="No pudimos cargar tu registro" actionLabel="Reintentar" onAction={() => void history.refetch()} />
        ) : (
          <StateView
            icon="archive"
            title={filtered ? 'Nada con estos filtros' : 'Todavía no tenés subastas'}
            body={filtered ? 'Probá con otro rol, estado o búsqueda.' : 'Las subastas que publiques o en las que pujes quedan registradas acá.'}
            actionLabel={filtered ? 'Limpiar filtros' : undefined}
            onAction={reset}
          />
        )
      }
      ListFooterComponent={<ListFooterSkeleton visible={history.isFetchingNextPage} />}
      onEndReached={() => {
        if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={history.isRefetching && !history.isFetchingNextPage} onRefresh={() => void history.refetch()} tintColor={Colors.textMuted} />
      }
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Layout.screenX },
  header: { gap: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  chips: { gap: Spacing.sm, paddingRight: Layout.screenX },
  count: { ...Type.label, color: Colors.textMuted },
  separator: { height: Spacing.sm },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  pressed: { backgroundColor: Colors.overlay },
  thumb: { width: 72, height: 72, borderRadius: Radius.xs, backgroundColor: Colors.overlay, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  info: { flex: 1, gap: Spacing.xs },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  title: { flex: 1, ...Type.bodyStrong, color: Colors.text },
  meta: { ...Type.caption, color: Colors.textMuted },
  prices: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  right: { alignItems: 'flex-end' },
  priceLabel: { ...Type.labelSm, color: Colors.textMuted },
  price: { ...Type.bodyStrong, color: Colors.text },
  outcome: { ...Type.caption, marginTop: Spacing.xs },
});

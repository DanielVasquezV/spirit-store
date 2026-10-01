import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuctionHistory } from '@/features/auctions/components/auction-history';
import { FilterBottomSheet } from '@/components/filter-bottom-sheet';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { ProductCard } from '@/components/product-card';
import { SearchBar } from '@/components/search-bar';
import { ListFooterSkeleton, ListSkeleton, StateView } from '@/components/state-view';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { currentPrice } from '@/features/auctions/auction-rules';
import { useRequireAuth } from '@/features/auth/use-require-auth';
import { useLiveAuctionList } from '@/features/auctions/use-live-auction-list';
import { CATEGORY_OPTIONS, saleBadges, vehicleSpecs } from '@/lib/taxonomy';

const CATEGORY_CHIPS = [{ value: 'all' as const, label: 'Todo' }, ...CATEGORY_OPTIONS];

type AuctionsView = 'live' | 'history';

const VIEWS: { value: AuctionsView; label: string }[] = [
  { value: 'live', label: 'En vivo' },
  { value: 'history', label: 'Mi registro' },
];

export default function AuctionsScreen() {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<AuctionsView>('live');
  const { isGuest } = useRequireAuth();
  const { query, setQuery, filters, updateFilter, resetFilters, resetAll, filtered, auctions, all, results } = useLiveAuctionList();
  const [sheetVisible, setSheetVisible] = useState(false);

  const header = (
    <View>
      <View style={styles.search}>
        <SearchBar value={query} onSearch={setQuery} onFilterPress={() => setSheetVisible(true)} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CATEGORY_CHIPS.map((category) => (
          <Chip
            key={category.value}
            label={category.label}
            selected={filters.category === category.value}
            onPress={() => updateFilter({ category: category.value })}
          />
        ))}
      </ScrollView>

      <View style={styles.results}>
        <SectionHeader title="En vivo ahora" count={`${results.length} ${results.length === 1 ? 'SUBASTA' : 'SUBASTAS'}`} />
        {filtered ? <Button label="Limpiar filtros" variant="ghost" size="sm" onPress={resetFilters} /> : null}
      </View>
    </View>
  );

  const empty = auctions.isPending ? (
    <ListSkeleton />
  ) : auctions.isError ? (
    <StateView icon="wifi-off" title="No pudimos cargar las subastas" body="Revisá tu conexión e intentá de nuevo." actionLabel="Reintentar" onAction={() => void auctions.refetch()} />
  ) : (
    <StateView
      icon="activity"
      title="Sin subastas"
      body={all.length > 0 ? 'Probá con otra marca o limpiá los filtros.' : 'No hay subastas en vivo en este momento.'}
      actionLabel={query || filtered ? 'Limpiar búsqueda' : undefined}
      onAction={resetAll}
    />
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Subastas" />
      <View style={styles.views}>
        {VIEWS.map((item) => (
          <Chip key={item.value} label={item.label} selected={view === item.value} onPress={() => setView(item.value)} />
        ))}
      </View>
      {view === 'history' && isGuest ? (
        <SignInPrompt
          icon="archive"
          title="Tu registro de subastas"
          body="Iniciá sesión para ver las subastas que creaste, las que ganaste y en las que pujaste."
          onSignIn={() => router.push('/login')}
          onRegister={() => router.push('/register')}
        />
      ) : view === 'history' ? (
        <AuctionHistory bottomInset={104 + insets.bottom} />
      ) : (
      <FlatList
        data={results}
        keyExtractor={(auction) => auction.id}
        renderItem={({ item }) => (
          <ProductCard
            title={item.vehicle.title}
            price={currentPrice(item)}
            priceCaption={item.currentBid === null ? 'Puja inicial' : `Puja actual · ${item.bidCount} pujas`}
            imageUrl={item.vehicle.images[0]?.url}
            badges={saleBadges(item.vehicle.saleType)}
            specs={vehicleSpecs(item.vehicle)}
            onPress={() => router.push(`/auction/${item.id}`)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<ListFooterSkeleton visible={auctions.isFetchingNextPage} />}
        onEndReached={() => {
          if (auctions.hasNextPage && !auctions.isFetchingNextPage) void auctions.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={auctions.isRefetching && !auctions.isFetchingNextPage} onRefresh={() => void auctions.refetch()} tintColor={Colors.textMuted} />
        }
        contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
      )}

      <FilterBottomSheet
        visible={sheetVisible}
        filters={filters}
        isActive={filtered}
        onChange={updateFilter}
        onReset={resetFilters}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Layout.screenX },
  search: { paddingTop: Spacing.md },
  views: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Layout.screenX, paddingTop: Spacing.sm },
  chips: { paddingTop: Spacing.lg, gap: Spacing.sm, paddingRight: Layout.screenX },
  results: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xl, marginBottom: Spacing.lg },
  separator: { height: Layout.gap },
});

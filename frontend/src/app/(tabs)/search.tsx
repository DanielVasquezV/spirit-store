import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterBottomSheet } from '@/components/filter-bottom-sheet';
import { SearchBar } from '@/components/search-bar';
import { ListFooterSkeleton, ListSkeleton, StateView } from '@/components/state-view';
import { VehicleCard } from '@/components/vehicle-card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { useCatalogSearch } from '@/features/catalog/use-catalog-filters';
import { CATEGORY_OPTIONS } from '@/lib/taxonomy';

const CATEGORY_CHIPS = [{ value: 'all' as const, label: 'Todo' }, ...CATEGORY_OPTIONS];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const { query, setQuery, filters, updateFilter, resetFilters, filtered, searching, search, results, total } = useCatalogSearch(params);
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
        <SectionHeader title={searching ? 'Resultados' : 'Catálogo'} count={`${total} ${total === 1 ? 'VEHÍCULO' : 'VEHÍCULOS'}`} />
        {filtered ? <Button label="Limpiar filtros" variant="ghost" size="sm" onPress={resetFilters} /> : null}
      </View>
    </View>
  );

  const empty = search.isPending ? (
    <ListSkeleton />
  ) : search.isError ? (
    <StateView icon="wifi-off" title="No pudimos buscar" body="Revisá tu conexión e intentá de nuevo." actionLabel="Reintentar" onAction={() => void search.refetch()} />
  ) : (
    <StateView
      icon="search"
      title="Sin resultados"
      body={searching ? 'Probá con otra marca, modelo o limpiá los filtros.' : 'No hay vehículos registrados todavía.'}
      actionLabel={filtered ? 'Limpiar filtros' : undefined}
      onAction={resetFilters}
    />
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Buscar" />
      <FlatList
        data={results}
        keyExtractor={(vehicle) => vehicle.id}
        renderItem={({ item }) => <VehicleCard vehicle={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<ListFooterSkeleton visible={search.isFetchingNextPage} />}
        onEndReached={() => {
          if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

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
  chips: { paddingTop: Spacing.lg, gap: Spacing.sm, paddingRight: Layout.screenX },
  results: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xl, marginBottom: Spacing.lg },
  separator: { height: Layout.gap },
});

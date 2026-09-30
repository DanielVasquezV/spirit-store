import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { FilterBottomSheet, DEFAULT_FILTERS, type Filters } from '@/components/filter-bottom-sheet';
import { ProductCard } from '@/components/product-card';
import { SearchBar } from '@/components/search-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Colors, Layout, Spacing, Type } from '@/constants/theme';
import { AUCTION_PRODUCTS, CATEGORIES, saleBadges, vehicleSpecs } from '@/lib/mock-data';
import { applySearch } from '@/lib/search';

export default function AuctionsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sheetVisible, setSheetVisible] = useState(false);

  const results = applySearch(AUCTION_PRODUCTS, query, filters);
  const hasActiveFilters =
    filters.price !== 'all' || filters.category !== 'all' || filters.transmission !== 'all' || filters.fuel !== 'Todos';

  const updateFilter = (update: Partial<Filters>) => setFilters((current) => ({ ...current, ...update }));
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Subastas" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.search}>
          <SearchBar onSearch={setQuery} onFilterPress={() => setSheetVisible(true)} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {CATEGORIES.map((category) => (
            <Chip
              key={category.id}
              label={category.label}
              selected={filters.category === category.id}
              onPress={() => updateFilter({ category: category.id })}
            />
          ))}
        </ScrollView>

        <View style={styles.results}>
          <SectionHeader title="En vivo ahora" count={`${results.length} ${results.length === 1 ? 'SUBASTA' : 'SUBASTAS'}`} />
          {hasActiveFilters ? <Button label="Limpiar filtros" variant="ghost" size="sm" onPress={resetFilters} /> : null}
        </View>

        {results.length > 0 ? (
          <View style={styles.list}>
            {results.map((product) => (
              <ProductCard
                key={product.id}
                title={product.title}
                price={product.price}
                priceCaption="Puja inicial"
                badges={saleBadges(product.saleType)}
                specs={vehicleSpecs(product)}
                onPress={() => router.push(`/auction/${product.id}`)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Feather name="activity" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Sin subastas</Text>
            <Text style={styles.emptyHint}>Probá con otra marca o limpiá los filtros.</Text>
            {query || hasActiveFilters ? (
              <Button label="Limpiar búsqueda" variant="secondary" size="sm" onPress={() => { setQuery(''); resetFilters(); }} />
            ) : null}
          </View>
        )}
      </ScrollView>

      <FilterBottomSheet
        visible={sheetVisible}
        filters={filters}
        isActive={hasActiveFilters}
        onChange={updateFilter}
        onReset={resetFilters}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Layout.screenX },
  search: { paddingTop: Spacing.md },
  chips: { paddingTop: Spacing.lg, gap: Spacing.sm, paddingRight: Layout.screenX },
  results: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xl, marginBottom: Spacing.lg },
  list: { gap: Layout.gap },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.huge, paddingHorizontal: Spacing.xxl },
  emptyTitle: { ...Type.h3, color: Colors.text },
  emptyHint: { ...Type.body, color: Colors.textMuted, textAlign: 'center' },
});
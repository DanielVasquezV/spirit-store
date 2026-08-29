import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/logo';
import { ProductCard } from '@/components/product-card';
import { SearchBar } from '@/components/search-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { SectionHeader } from '@/components/ui/section-header';
import { Colors, Layout, Spacing, Type } from '@/constants/theme';
import { CATEGORIES, CART_COUNT, FEATURED_PRODUCTS, saleBadges, vehicleSpecs } from '@/lib/mock-data';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('all');

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Logo />
            <Text style={styles.tagline}>Vehículos con carácter</Text>
          </View>
          <IconButton
            icon="shopping-bag"
            accessibilityLabel="Carrito"
            badge={CART_COUNT}
            onPress={() => router.push('/cart')}
          />
        </View>

        <SearchBar onFilterPress={() => {}} />

        <View style={styles.section}>
          <SectionHeader title="Categorías" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            {CATEGORIES.map((category) => (
              <Chip
                key={category.id}
                label={category.label}
                selected={activeCategory === category.id}
                onPress={() => setActiveCategory(category.id)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Destacados"
            count={`${FEATURED_PRODUCTS.length} VEHÍCULOS`}
            action={<Button label="Ver todos" variant="ghost" size="sm" onPress={() => router.push('/explore')} />}
          />
          <View style={styles.products}>
            {FEATURED_PRODUCTS.map((product) => (
              <ProductCard
                key={product.id}
                title={product.title}
                price={product.price}
                badges={saleBadges(product.saleType)}
                specs={vehicleSpecs(product)}
                onPress={() => {}}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: {
    paddingHorizontal: Layout.screenX,
    paddingBottom: 104,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  brand: { gap: Spacing.xs },
  tagline: { ...Type.caption, color: Colors.textMuted },
  section: { marginTop: Spacing.xxl, gap: Spacing.lg },
  chips: { gap: Spacing.sm, paddingRight: Layout.screenX },
  products: { gap: Layout.gap },
});
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '@/components/product-card';
import { SectionHeader } from '@/components/ui/section-header';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { AUCTION_PRODUCTS, saleBadges, vehicleSpecs } from '@/lib/mock-data';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Explorar" right={<View />} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <SectionHeader title="Subastas en vivo" count={`${AUCTION_PRODUCTS.length} ACTIVAS`} />
          <View style={styles.products}>
            {AUCTION_PRODUCTS.map((product) => (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Layout.screenX },
  section: { paddingTop: Spacing.md, gap: Spacing.lg },
  products: { gap: Layout.gap },
});
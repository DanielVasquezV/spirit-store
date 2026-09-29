import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { AuctionCard } from '@/components/auction-card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { AUCTION_PRODUCTS } from '@/lib/mock-data';

export default function AuctionsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Subastas" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Feather name="zap" size={18} color={Colors.warning} />
          <Text style={styles.heroText}>Las ofertas avanzan en tiempo real: pujá antes de que cierre el contador.</Text>
        </View>
        <View style={styles.list}>
          {AUCTION_PRODUCTS.map((product) => (
            <AuctionCard key={product.id} vehicleId={product.id} startPrice={product.price} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.md },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  heroText: { flex: 1, ...Type.caption, color: Colors.textSecondary },
  list: { gap: Layout.gap, paddingTop: Spacing.xl },
});
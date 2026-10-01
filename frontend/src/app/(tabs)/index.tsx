import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/logo';
import { SearchBar } from '@/components/search-bar';
import { ListSkeleton, StateView } from '@/components/state-view';
import { VehicleCard } from '@/components/vehicle-card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { SectionHeader } from '@/components/ui/section-header';
import { Colors, Layout, Spacing, Type } from '@/constants/theme';
import { useRequireAuth } from '@/features/auth/use-require-auth';
import { useFeaturedVehicles } from '@/features/catalog/use-catalog';
import { usePendingPurchases } from '@/features/orders/use-orders';
import { CATEGORY_OPTIONS } from '@/lib/taxonomy';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  // El badge cuenta compras esperando pago: es lo único que pide acción desde el ícono.
  const pendingPurchases = usePendingPurchases();
  const { requireAuth } = useRequireAuth();
  const featured = useFeaturedVehicles();
  const vehicles = featured.data?.items ?? [];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={featured.isRefetching} onRefresh={() => void featured.refetch()} tintColor={Colors.textMuted} />
        }>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Logo />
            <Text style={styles.tagline}>Vehículos con carácter</Text>
          </View>
          <IconButton
            icon="shopping-bag"
            accessibilityLabel="Mis compras"
            badge={pendingPurchases.length}
            onPress={() => requireAuth(() => router.push('/purchases'))}
          />
        </View>

        {/* Home no busca en sitio: cualquier intención de búsqueda abre la pestaña Buscar. */}
        <SearchBar onFilterPress={() => router.push('/search')} onSubmit={(q) => router.push({ pathname: '/search', params: { q } })} />

        <View style={styles.section}>
          <SectionHeader title="Categorías" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            {CATEGORY_OPTIONS.map((category) => (
              <Chip
                key={category.value}
                label={category.label}
                onPress={() => router.push({ pathname: '/search', params: { category: category.value } })}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Destacados"
            count={featured.data ? `${featured.data.total} DISPONIBLES` : undefined}
            action={<Button label="Ver todos" variant="ghost" size="sm" onPress={() => router.push('/search')} />}
          />
          {featured.isPending ? (
            <ListSkeleton count={2} />
          ) : featured.isError ? (
            <StateView icon="wifi-off" title="No pudimos cargar el catálogo" body="Revisá tu conexión e intentá de nuevo." actionLabel="Reintentar" onAction={() => void featured.refetch()} />
          ) : vehicles.length === 0 ? (
            <StateView icon="truck" title="Sin vehículos disponibles" body="Todavía no hay publicaciones en venta." />
          ) : (
            <View style={styles.products}>
              {vehicles.map((vehicle) => (
                <VehicleCard key={vehicle.id} vehicle={vehicle} />
              ))}
            </View>
          )}
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
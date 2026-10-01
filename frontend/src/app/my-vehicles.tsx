import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ListFooterSkeleton, ListSkeleton, StateView } from '@/components/state-view';
import { VehicleCard } from '@/components/vehicle-card';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { flattenPages, useMyVehicles } from '@/features/catalog/use-catalog';
import { VEHICLE_STATUS_LABELS } from '@/lib/taxonomy';

export default function MyVehiclesScreen() {
  const vehicles = useMyVehicles();
  const items = flattenPages(vehicles.data?.pages);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScreenHeader
        title="Mis vehículos"
        onBack={() => router.back()}
        right={<Button label="Publicar" variant="ghost" size="sm" onPress={() => router.push('/vehicle/new')} />}
      />
      <FlatList
        data={items}
        keyExtractor={(vehicle) => vehicle.id}
        renderItem={({ item }) => (
          <VehicleCard vehicle={item} priceCaption={VEHICLE_STATUS_LABELS[item.status]} onPress={() => router.push(`/product/${item.id}`)} />
        )}
        ListEmptyComponent={
          vehicles.isPending ? (
            <ListSkeleton count={2} />
          ) : vehicles.isError ? (
            <StateView icon="wifi-off" title="No pudimos cargar tus vehículos" actionLabel="Reintentar" onAction={() => void vehicles.refetch()} />
          ) : (
            <StateView icon="truck" title="Todavía no publicaste" body="Tus publicaciones, borradores y ventas aparecen acá." actionLabel="Publicar un vehículo" onAction={() => router.push('/vehicle/new')} />
          )
        }
        ListFooterComponent={<ListFooterSkeleton visible={vehicles.isFetchingNextPage} />}
        onEndReached={() => {
          if (vehicles.hasNextPage && !vehicles.isFetchingNextPage) void vehicles.fetchNextPage();
        }}
        refreshControl={<RefreshControl refreshing={vehicles.isRefetching} onRefresh={() => void vehicles.refetch()} tintColor={Colors.textMuted} />}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Layout.screenX, paddingBottom: Spacing.huge },
  separator: { height: Layout.gap },
});

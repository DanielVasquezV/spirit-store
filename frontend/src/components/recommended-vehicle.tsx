import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Hairline, Radius, Spacing, Type } from '@/constants/theme';
import { formatPriceParts } from '@/lib/format';
import { SALE_TYPE_LABELS } from '@/lib/taxonomy';
import type { RecommendedVehicleDto } from '@/lib/types/api';

// Tarjeta compacta de un vehículo del catálogo recomendado por el asistente.
export function RecommendedVehicle({ vehicle }: { vehicle: RecommendedVehicleDto }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(vehicle.auctionId ? `/auction/${vehicle.auctionId}` : `/product/${vehicle.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.thumb}>
        {vehicle.imageUrl ? (
          <Image source={{ uri: vehicle.imageUrl }} style={styles.image} contentFit="cover" />
        ) : (
          <Feather name="truck" size={20} color={Colors.borderStrong} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{vehicle.title}</Text>
        <Text style={styles.meta}>{vehicle.year} · {vehicle.auctionId ? 'En subasta' : SALE_TYPE_LABELS[vehicle.saleType]}</Text>
      </View>
      <Text style={styles.price}>${formatPriceParts(vehicle.basePrice).whole}</Text>
      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.sm,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  pressed: { backgroundColor: Colors.overlay },
  thumb: { width: 48, height: 48, borderRadius: Radius.xs, backgroundColor: Colors.overlay, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  info: { flex: 1, gap: 2 },
  title: { ...Type.bodyStrong, color: Colors.text },
  meta: { ...Type.caption, color: Colors.textMuted },
  price: { ...Type.bodyStrong, color: Colors.text },
});

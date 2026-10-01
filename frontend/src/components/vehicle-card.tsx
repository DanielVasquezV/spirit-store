import { router } from 'expo-router';
import { ProductCard } from '@/components/product-card';
import { vehicleBadges, vehicleHref, vehiclePrice, vehicleSpecs } from '@/lib/taxonomy';
import type { VehicleDto } from '@/lib/types/api';

type VehicleCardProps = { vehicle: VehicleDto; priceCaption?: string; onPress?: () => void };

export function VehicleCard({ vehicle, priceCaption, onPress }: VehicleCardProps) {
  const price = vehiclePrice(vehicle);
  return (
    <ProductCard
      title={vehicle.title}
      price={price.amount}
      priceCaption={priceCaption ?? price.caption}
      imageUrl={vehicle.images[0]?.url}
      badges={vehicleBadges(vehicle)}
      specs={vehicleSpecs(vehicle)}
      onPress={onPress ?? (() => router.push(vehicleHref(vehicle)))}
    />
  );
}

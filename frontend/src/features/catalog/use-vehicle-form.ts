import { useState } from 'react';
import { useSession } from '@/features/auth/session-provider';
import { useImageUpload } from '@/features/profile/use-image-upload';
import { fieldErrors } from '@/lib/api/api-error';
import type { CreateVehicleInput } from '@/lib/api/vehicles';
import type { Condition, Fuel, SaleType, Transmission, UploadedAssetDto, VehicleCategory, VehicleDto } from '@/lib/types/api';
import { useCreateVehicle } from './use-catalog';

export const AUCTION_DAYS = [1, 3, 7] as const;
export type AuctionDays = (typeof AUCTION_DAYS)[number];

const EMPTY_TEXT = {
  brand: '', model: '', year: '', mileage: '', vin: '', licensePlate: '', color: '',
  engine: '', power: '', drivetrain: '', basePrice: '', description: '', startingPrice: '', minBidIncrement: '5',
};

export type VehicleTextField = keyof typeof EMPTY_TEXT;

// Los inputs numéricos aceptan coma de miles: se limpian antes de enviar al backend.
const toNumber = (text: string) => Number(text.replace(/[^\d.]/g, ''));

// Formulario de publicación: estado de los campos, fotos, armado del payload y envío.
export function useVehicleForm() {
  const { user } = useSession();
  const photos = useImageUpload('vehicles');
  const create = useCreateVehicle();
  const [text, setText] = useState(EMPTY_TEXT);
  const [transmission, setTransmission] = useState<Transmission>('AUTOMATIC');
  const [fuel, setFuel] = useState<Fuel>('GASOLINE');
  const [category, setCategory] = useState<VehicleCategory>('SEDAN');
  const [condition, setCondition] = useState<Condition>('USED');
  const [saleType, setSaleType] = useState<SaleType>('DIRECT_SALE');
  const [auctionDays, setAuctionDays] = useState<AuctionDays>(3);
  const [images, setImages] = useState<UploadedAssetDto[]>([]);

  const setField = (key: VehicleTextField) => (value: string) => setText((current) => ({ ...current, [key]: value }));
  const withAuction = saleType !== 'DIRECT_SALE';

  const addPhotos = async () => {
    const uploaded = await photos.pickAndUpload({ multiple: true });
    if (uploaded) setImages((current) => [...current, ...uploaded]);
  };
  const removePhoto = (publicId: string) => setImages((current) => current.filter((image) => image.publicId !== publicId));

  const toPayload = (): CreateVehicleInput => ({
    brand: text.brand.trim(),
    model: text.model.trim(),
    year: toNumber(text.year),
    mileage: toNumber(text.mileage),
    vin: text.vin.trim(),
    licensePlate: text.licensePlate.trim(),
    color: text.color.trim() || undefined,
    engine: text.engine.trim(),
    power: text.power.trim(),
    drivetrain: text.drivetrain.trim(),
    transmission,
    fuel,
    category,
    condition,
    basePrice: toNumber(text.basePrice),
    saleType,
    description: text.description.trim() || undefined,
    images: images.map((image) => ({ url: image.url, publicId: image.publicId })),
    // Sin puja inicial propia se arranca en el precio de venta; la subasta dura los días elegidos desde ahora.
    auction: withAuction
      ? {
          startingPrice: toNumber(text.startingPrice || text.basePrice),
          minBidIncrement: toNumber(text.minBidIncrement) || undefined,
          endTime: new Date(Date.now() + auctionDays * 86_400_000).toISOString(),
        }
      : undefined,
  });

  // Publica y resuelve el vehículo creado, o null si el backend lo rechazó (los errores quedan en `errors`).
  const submit = (): Promise<VehicleDto | null> => create.mutateAsync(toPayload()).catch(() => null);

  return {
    text,
    setField,
    transmission,
    setTransmission,
    fuel,
    setFuel,
    category,
    setCategory,
    condition,
    setCondition,
    saleType,
    setSaleType,
    auctionDays,
    setAuctionDays,
    withAuction,
    images,
    addPhotos,
    removePhoto,
    uploading: photos.uploading,
    uploadError: photos.error,
    needsDui: user?.duiStatus === 'NONE',
    submit,
    submitting: create.isPending,
    // Los errores por campo del backend vienen con la ruta del campo (auction.endTime) y se muestran tal cual.
    errors: fieldErrors(create.error),
    submitError: create.error,
  };
}

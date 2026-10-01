import { Image } from 'expo-image';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { ChipGroup } from '@/components/ui/chip-group';
import { Field } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StickyCta } from '@/components/ui/sticky-cta';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { AUCTION_DAYS, useVehicleForm, type AuctionDays } from '@/features/catalog/use-vehicle-form';
import { messageFor } from '@/lib/api/api-error';
import {
  CATEGORY_OPTIONS,
  CONDITION_LABELS,
  FUEL_OPTIONS,
  SALE_TYPE_LABELS,
  TRANSMISSION_OPTIONS,
} from '@/lib/taxonomy';
import { CONDITIONS, SALE_TYPES } from '@/lib/types/api';

const CONDITION_OPTIONS = CONDITIONS.map((value) => ({ value, label: CONDITION_LABELS[value] }));
const SALE_TYPE_OPTIONS = SALE_TYPES.map((value) => ({ value, label: SALE_TYPE_LABELS[value] }));
const DURATION_OPTIONS = AUCTION_DAYS.map((days) => ({ value: String(days) as `${AuctionDays}`, label: `${days} ${days === 1 ? 'día' : 'días'}` }));

export default function NewVehicleScreen() {
  const form = useVehicleForm();
  const { text: values, setField: set, errors } = form;

  const submit = () =>
    void form.submit().then((vehicle) => {
      if (vehicle) router.replace(vehicle.auction ? `/auction/${vehicle.auction.id}` : `/product/${vehicle.id}`);
    });

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Publicar vehículo" onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          {form.needsDui ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>Para publicar necesitás cargar tu DUI en el perfil.</Text>
              <Button label="Ir al perfil" variant="secondary" size="sm" onPress={() => router.push('/profile')} />
            </View>
          ) : null}

          <Text style={styles.section}>Fotos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {form.images.map((image) => (
              <View key={image.publicId} style={styles.photo}>
                <Image source={{ uri: image.url }} style={styles.photoImage} contentFit="cover" />
                <View style={styles.photoRemove}>
                  <IconButton icon="x" accessibilityLabel="Quitar foto" size={28} iconSize={14} onPress={() => form.removePhoto(image.publicId)} />
                </View>
              </View>
            ))}
            <View style={[styles.photo, styles.photoAdd]}>
              <IconButton icon="plus" accessibilityLabel="Agregar fotos" disabled={form.uploading} onPress={() => void form.addPhotos()} />
              <Text style={styles.photoHint}>{form.uploading ? 'Subiendo…' : 'Agregar'}</Text>
            </View>
          </ScrollView>
          {form.uploadError || errors.images ? <Text style={styles.error}>{form.uploadError ?? errors.images}</Text> : null}

          <Text style={styles.section}>Datos</Text>
          <Field label="Marca" value={values.brand} onChangeText={set('brand')} error={errors.brand} placeholder="Toyota" />
          <Field label="Modelo" value={values.model} onChangeText={set('model')} error={errors.model} placeholder="Hilux SRX" />
          <View style={styles.row}>
            <View style={styles.cell}>
              <Field label="Año" value={values.year} onChangeText={set('year')} error={errors.year} keyboardType="number-pad" placeholder="2023" />
            </View>
            <View style={styles.cell}>
              <Field label="Kilometraje" value={values.mileage} onChangeText={set('mileage')} error={errors.mileage} keyboardType="number-pad" placeholder="18500" />
            </View>
          </View>
          <Field label="VIN" value={values.vin} onChangeText={set('vin')} error={errors.vin} autoCapitalize="characters" placeholder="17 caracteres" maxLength={17} />
          <View style={styles.row}>
            <View style={styles.cell}>
              <Field label="Placa" value={values.licensePlate} onChangeText={set('licensePlate')} error={errors.licensePlate} autoCapitalize="characters" placeholder="P123-456" />
            </View>
            <View style={styles.cell}>
              <Field label="Color" value={values.color} onChangeText={set('color')} error={errors.color} placeholder="Opcional" />
            </View>
          </View>
          <ChipGroup label="Categoría" options={CATEGORY_OPTIONS} value={form.category} onChange={form.setCategory} />
          <ChipGroup label="Condición" options={CONDITION_OPTIONS} value={form.condition} onChange={form.setCondition} />

          <Text style={styles.section}>Mecánica</Text>
          <Field label="Motor" value={values.engine} onChangeText={set('engine')} error={errors.engine} placeholder="2.8L Diésel Turbo" />
          <View style={styles.row}>
            <View style={styles.cell}>
              <Field label="Potencia" value={values.power} onChangeText={set('power')} error={errors.power} placeholder="204 HP" />
            </View>
            <View style={styles.cell}>
              <Field label="Tracción" value={values.drivetrain} onChangeText={set('drivetrain')} error={errors.drivetrain} placeholder="4x4" />
            </View>
          </View>
          <ChipGroup label="Transmisión" options={TRANSMISSION_OPTIONS} value={form.transmission} onChange={form.setTransmission} />
          <ChipGroup label="Combustible" options={FUEL_OPTIONS} value={form.fuel} onChange={form.setFuel} />

          <Text style={styles.section}>Venta</Text>
          <ChipGroup label="Tipo de venta" options={SALE_TYPE_OPTIONS} value={form.saleType} onChange={form.setSaleType} />
          <Field label="Precio de venta (USD)" value={values.basePrice} onChangeText={set('basePrice')} error={errors.basePrice} keyboardType="decimal-pad" placeholder="42900" />
          {form.withAuction ? (
            <>
              <View style={styles.row}>
                <View style={styles.cell}>
                  <Field label="Puja inicial" value={values.startingPrice} onChangeText={set('startingPrice')} error={errors['auction.startingPrice']} keyboardType="decimal-pad" placeholder="Igual al precio" />
                </View>
                <View style={styles.cell}>
                  <Field label="Incremento mínimo" value={values.minBidIncrement} onChangeText={set('minBidIncrement')} error={errors['auction.minBidIncrement']} keyboardType="decimal-pad" />
                </View>
              </View>
              <ChipGroup
                label="Duración de la subasta"
                options={DURATION_OPTIONS}
                value={String(form.auctionDays) as `${AuctionDays}`}
                onChange={(value) => form.setAuctionDays(Number(value) as AuctionDays)}
              />
              {errors.auction || errors['auction.endTime'] ? <Text style={styles.error}>{errors.auction ?? errors['auction.endTime']}</Text> : null}
            </>
          ) : null}
          <Field
            label="Descripción"
            value={values.description}
            onChangeText={set('description')}
            error={errors.description}
            placeholder="Historial, extras, estado general…"
            multiline
          />

          {form.submitError ? <Text style={styles.error}>{messageFor(form.submitError, 'No pudimos publicar el vehículo.')}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <StickyCta>
        <Button
          label={form.submitting ? 'Publicando…' : 'Publicar'}
          fullWidth
          size="lg"
          disabled={form.submitting || form.uploading || form.needsDui}
          onPress={submit}
        />
      </StickyCta>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.md, paddingBottom: Layout.ctaBarHeight * 2, gap: Spacing.lg },
  section: { ...Type.label, color: Colors.textMuted, marginTop: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  cell: { flex: 1 },
  error: { ...Type.caption, color: Colors.danger },
  notice: {
    gap: Spacing.md,
    padding: Layout.cardPadding,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
  },
  noticeText: { ...Type.body, color: Colors.textSecondary },
  photos: { gap: Spacing.sm },
  photo: { width: 96, height: 96, borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: Colors.overlay },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: Spacing.xs, right: Spacing.xs },
  photoAdd: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, borderWidth: Hairline, borderColor: Colors.borderStrong },
  photoHint: { ...Type.labelSm, color: Colors.textMuted },
});

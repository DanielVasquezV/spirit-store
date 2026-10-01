import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { PhotoGallery } from '@/components/photo-gallery';
import { DetailSkeleton } from '@/components/state-view';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { StickyCta } from '@/components/ui/sticky-cta';
import { Colors, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { useRequireAuth } from '@/features/auth/use-require-auth';
import { useVehicleDetail } from '@/features/catalog/use-vehicle-detail';
import { messageFor } from '@/lib/api/api-error';
import { techSpecs, vehicleBadges, vehiclePrice } from '@/lib/taxonomy';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const detail = useVehicleDetail(id);
  const { requireAuth } = useRequireAuth();
  const { vehicle: product, query: vehicleQuery, isOwn: own, liveAuction, buyable, myPendingOrder } = detail;

  if (vehicleQuery.isPending) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Cargando" onBack={() => router.back()} />
        <DetailSkeleton />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>{detail.loadFailed ? 'No pudimos cargar el vehículo' : 'Vehículo no encontrado'}</Text>
        {detail.loadFailed ? <Button label="Reintentar" size="sm" variant="secondary" onPress={() => void vehicleQuery.refetch()} /> : null}
        <Button label="Volver al catálogo" size="sm" onPress={() => router.back()} />
      </View>
    );
  }

  const specs = techSpecs(product);
  const price = vehiclePrice(product);
  const buy = () => requireAuth(() => void detail.buy().then((order) => order && router.push(`/checkout/${order.id}`)));
  const contact = () => requireAuth(() => void detail.contact().then((chat) => chat && router.push(`/chat/${chat.id}`)));

  return (
    <View style={styles.screen}>
      <ScreenHeader title={product.model} subtitle={product.brand} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Layout.ctaBarHeight * 2 + insets.bottom + Spacing.lg }]}
        showsVerticalScrollIndicator={false}>
        <View>
          <PhotoGallery images={product.images.map((image) => image.url)} />
          <View style={styles.stageBadges}>
            {vehicleBadges(product).map((badge) => (
              <Badge key={badge} label={badge} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{product.title}</Text>
          <Price amount={price.amount} variant="hero" caption={price.caption ?? 'Precio de venta'} />
          {product.description ? <Text style={styles.description}>{product.description}</Text> : null}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Especificaciones" count="MECÁNICAS" />
          <View style={styles.specGrid}>
            {specs.map((spec) => (
              <View key={spec.label} style={styles.specCell}>
                <Text style={styles.specLabel}>{spec.label}</Text>
                <Text style={styles.specValue}>{spec.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Vendedor" />
          <View style={styles.seller}>
            <Avatar name={product.seller.fullName} size={48} />
            <View style={styles.sellerInfo}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{own ? 'Tú' : product.seller.fullName}</Text>
                {product.seller.isVerified ? <Feather name="check-circle" size={16} color={Colors.success} /> : null}
              </View>
              <Text style={styles.sellerMeta}>{product.seller.isVerified ? 'Vendedor verificado' : 'Vendedor sin verificar'}</Text>
            </View>
          </View>
        </View>

        {detail.contactError ? <Text style={styles.error}>{messageFor(detail.contactError, 'No pudimos abrir el chat.')}</Text> : null}
        {detail.buyError ? <Text style={styles.error}>{messageFor(detail.buyError, 'No pudimos reservar el vehículo.')}</Text> : null}
      </ScrollView>

      <StickyCta>
        {liveAuction ? (
          <Button label="Ver subasta en vivo" fullWidth size="lg" onPress={() => router.push(`/auction/${liveAuction.id}`)} />
        ) : myPendingOrder ? (
          <Button label="Continuar pago" fullWidth size="lg" onPress={() => router.push(`/checkout/${myPendingOrder.id}`)} />
        ) : buyable ? (
          <Button label={detail.buying ? 'Reservando…' : 'Comprar ahora'} fullWidth size="lg" disabled={detail.buying} onPress={buy} />
        ) : null}
        {own ? null : (
          <Button
            label={detail.contacting ? 'Abriendo chat…' : 'Contactar con Vendedor'}
            variant={liveAuction || buyable || myPendingOrder ? 'secondary' : 'primary'}
            fullWidth
            size="lg"
            disabled={detail.contacting}
            onPress={contact}
          />
        )}
      </StickyCta>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.md },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingHorizontal: Layout.screenX },
  missingText: { ...Type.h2, color: Colors.text },
  stageBadges: { position: 'absolute', top: Spacing.md, left: Spacing.md, flexDirection: 'row', gap: Spacing.sm },
  section: { marginTop: Spacing.xxl, gap: Spacing.md },
  title: { ...Type.h1, color: Colors.text },
  description: { ...Type.body, color: Colors.textSecondary },
  error: { ...Type.caption, color: Colors.danger, marginTop: Spacing.lg },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  specCell: {
    width: '47%',
    flexGrow: 1,
    gap: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  specLabel: { ...Type.labelSm, color: Colors.textMuted },
  specValue: { ...Type.body, color: Colors.text },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  sellerInfo: { flex: 1, gap: Spacing.xs },
  sellerNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
  sellerName: { ...Type.bodyStrong, color: Colors.text },
  sellerMeta: { ...Type.caption, color: Colors.textMuted },
});
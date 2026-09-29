import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { StickyCta } from '@/components/ui/sticky-cta';
import { Colors, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { getProductById, SELLERS, techSpecs, saleBadges } from '@/lib/mock-data';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const product = id ? getProductById(id) : undefined;

  if (!product) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Vehículo no encontrado</Text>
        <Button label="Volver al catálogo" size="sm" onPress={() => router.back()} />
      </View>
    );
  }

  const seller = SELLERS[product.id];
  const specs = techSpecs(product);

  return (
    <View style={styles.screen}>
      <ScreenHeader title={product.model} subtitle={product.brand} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Layout.ctaBarHeight + insets.bottom + Spacing.lg }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.stage}>
          {/* Sin fotos reales todavía: marcador a escala de ficha. */}
          <Feather name="truck" size={56} color={Colors.borderStrong} />
          <Text style={styles.stageHint}>Imágenes próximamente</Text>
          <View style={styles.stageBadges}>
            {saleBadges(product.saleType).map((badge) => (
              <Badge key={badge} label={badge} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>{product.title}</Text>
          <Price amount={product.price} variant="hero" caption={product.saleType === 'AUCTION' ? 'Puja actual' : 'Precio de venta'} />
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

        {seller ? (
          <View style={styles.section}>
            <SectionHeader title="Vendedor" />
            <View style={styles.seller}>
              <Avatar name={seller.name} size={48} />
              <View style={styles.sellerInfo}>
                <View style={styles.sellerNameRow}>
                  <Text style={styles.sellerName}>{seller.name}</Text>
                  {seller.verified ? (
                    <Feather name="check-circle" size={16} color={Colors.success} />
                  ) : null}
                </View>
                <Text style={styles.sellerMeta}>
                  {seller.verified ? 'Vendedor verificado · ' : ''}
                  {seller.city}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <StickyCta>
        <Button
          label="Contactar con Vendedor"
          fullWidth
          size="lg"
          onPress={() => router.push(`/chat/${product.id}`)}
        />
      </StickyCta>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.md },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingHorizontal: Layout.screenX },
  missingText: { ...Type.h2, color: Colors.text },
  stage: {
    height: 240,
    borderRadius: Radius.md,
    backgroundColor: Colors.stageFrom,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  stageHint: { ...Type.labelSm, color: Colors.textMuted },
  stageBadges: { position: 'absolute', top: Spacing.md, left: Spacing.md, flexDirection: 'row', gap: Spacing.sm },
  section: { marginTop: Spacing.xxl, gap: Spacing.md },
  title: { ...Type.h1, color: Colors.text },
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
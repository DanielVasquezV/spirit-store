import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { Price } from '@/components/ui/price';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';

type ProductCardProps = {
  title: string;
  price: number;
  priceCaption?: string;
  imageUrl?: string;
  badges?: string[];
  specs?: string[];
  onPress?: () => void;
};

export function ProductCard({
  title,
  price,
  priceCaption,
  imageUrl,
  badges = [],
  specs = [],
  onPress,
}: ProductCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {badges.length > 0 ? (
        <View style={styles.badges}>
          {badges.map((badge) => (
            <Badge key={badge} label={badge} />
          ))}
        </View>
      ) : null}

      <View style={styles.stage}>
        {/* Sin imagen asignada todavía: marcador en vez de romper el layout */}
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" transition={200} />
        ) : (
          <View style={styles.placeholder}>
            <Feather name="truck" size={40} color={Colors.borderStrong} />
            <Text style={styles.placeholderText}>Imagen próximamente</Text>
          </View>
        )}
      </View>

      <Price amount={price} caption={priceCaption} />

      {specs.length > 0 ? (
        <View style={styles.specs}>
          {specs.map((spec) => (
            <Chip key={spec} label={spec} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
    padding: Layout.cardPadding,
    gap: Spacing.md,
  },
  pressed: { backgroundColor: Colors.overlay },
  title: { ...Type.h3, color: Colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs + 2 },
  stage: {
    height: 170,
    backgroundColor: Colors.stageFrom,
    borderRadius: Radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '80%', height: '80%' },
  placeholder: { alignItems: 'center', gap: Spacing.sm },
  placeholderText: { ...Type.labelSm, color: Colors.textMuted },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
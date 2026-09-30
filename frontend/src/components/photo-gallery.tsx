import { useState } from 'react';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type PhotoGalleryProps = { images: string[]; height?: number };

// Carrusel horizontal de fotos del vehículo; el ancho se mide para que el paging calce exacto.
export function PhotoGallery({ images, height = 240 }: PhotoGalleryProps) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <View style={[styles.stage, { height }]}>
        <Feather name="truck" size={52} color={Colors.borderStrong} />
        <Text style={styles.placeholderText}>Imágenes próximamente</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[styles.stage, { height }]}>
        {width > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const { contentOffset, layoutMeasurement } = event.nativeEvent;
              setIndex(Math.round(contentOffset.x / layoutMeasurement.width));
            }}>
            {images.map((uri) => (
              <Image key={uri} source={{ uri }} style={{ width, height }} contentFit="cover" transition={200} />
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.dots}>
        {images.map((uri, dot) => (
          <View key={uri} style={[styles.dot, dot === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  stage: { backgroundColor: Colors.stageFrom, borderRadius: Radius.md, overflow: 'hidden' },
  placeholderText: { ...Type.labelSm, color: Colors.textMuted, marginTop: Spacing.sm, alignSelf: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs + 2 },
  dot: { width: 6, height: 6, borderRadius: Radius.full, backgroundColor: Colors.overlayPressed },
  dotActive: { width: 16, backgroundColor: Colors.text },
});
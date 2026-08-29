import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Logo } from '@/components/logo';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

const SPLASH_DURATION = 2000;

export default function SplashScreen() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: SPLASH_DURATION, easing: Easing.inOut(Easing.quad) });
    // Timer único: la limpieza del efecto evita navegar dos veces.
    const timer = setTimeout(() => {
      router.replace('/(tabs)');
    }, SPLASH_DURATION + 250);
    return () => clearTimeout(timer);
  }, [progress]);

  // scaleX con transformOrigin en left: el relleno crece de izquierda a derecha.
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View style={styles.screen}>
      <View style={styles.center}>
        <Logo size="lg" />
        <Text style={styles.tagline}>Tu próximo vehículo, con carácter</Text>
      </View>

      <View style={styles.loader}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, barStyle]} />
        </View>
        <Text style={styles.loaderLabel}>Cargando</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.huge,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  tagline: { ...Type.bodySm, color: Colors.textMuted, textAlign: 'center' },
  loader: {
    alignSelf: 'stretch',
    gap: Spacing.sm + 2,
  },
  track: {
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.overlay,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    transformOrigin: 'left',
  },
  loaderLabel: {
    ...Type.labelSm,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 1.2,
  },
});
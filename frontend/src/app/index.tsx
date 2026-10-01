import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Logo } from '@/components/logo';
import { useSession } from '@/features/auth/session-provider';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

const SPLASH_DURATION = 2000;

export default function SplashScreen() {
  const { status } = useSession();
  const progress = useSharedValue(0);
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    progress.value = withTiming(1, { duration: SPLASH_DURATION, easing: Easing.inOut(Easing.quad) });
    // Tiempo mínimo de marca: aunque la sesión resuelva al instante, el splash no parpadea.
    const timer = setTimeout(() => setMinElapsed(true), SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, [progress]);

  useEffect(() => {
    if (!minElapsed || status === 'loading') return;
    // La cuenta no es obligatoria: con o sin sesión se entra a Home; solo se espera a saber cuál de las dos es.
    router.replace('/(tabs)');
  }, [minElapsed, status]);

  // scaleX con transformOrigin en left: el relleno crece de izquierda a derecha.
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View style={styles.screen}>
      <View style={styles.center}>
        {/* Mismo ancho que el splash nativo (imageWidth en app.json) para que el relevo no salte. */}
        <Logo variant="full" width={200} />
      </View>

      <View style={styles.loader}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, barStyle]} />
        </View>
        <Text style={styles.loaderLabel}>{status === 'loading' ? 'Cargando' : 'Listo'}</Text>
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
  },
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
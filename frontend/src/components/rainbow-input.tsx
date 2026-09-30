import { useEffect } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradient, Radius, Spacing, Type } from '@/constants/theme';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

const RING = 2;
const BLUR_SPEED = 9000;
const FOCUS_SPEED = 2400;

export function RainbowInput(props: TextInputProps) {
  const rotation = useSharedValue(0);

  const startSpin = (duration: number) => {
    // Bucle perpetuo: retoma la vuelta desde el ángulo actual al cambiar velocidad.
    rotation.value = withRepeat(withTiming(rotation.value + 360, { duration, easing: Easing.linear }), -1, false);
  };

  useEffect(() => {
    startSpin(BLUR_SPEED);
    // Solo arranca el loop inicial; la velocidad se cambia en focus/blur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  type FocusHandler = NonNullable<TextInputProps['onFocus']>;
type BlurHandler = NonNullable<TextInputProps['onBlur']>;

const focus: FocusHandler = (event) => {
    startSpin(FOCUS_SPEED);
    props.onFocus?.(event);
  };

  const blur: BlurHandler = (event) => {
    startSpin(BLUR_SPEED);
    props.onBlur?.(event);
  };

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: 2 }],
  }));

  return (
    <View style={styles.ring}>
      {/* Capa rotatoria redimensionada: el giro nunca destapa las esquinas del anillo. */}
      <AnimatedGradient colors={[...Gradient.rainbow]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gradient, ringStyle]} />
      <TextInput
        {...props}
        style={[styles.input, props.style]}
        placeholderTextColor={Colors.textMuted}
        selectionColor={Colors.text}
        onFocus={focus}
        onBlur={blur}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    flex: 1,
    borderRadius: Radius.full,
    padding: RING,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  gradient: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  input: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full - RING,
    backgroundColor: Colors.bg,
    ...Type.body,
    color: Colors.text,
    padding: 0,
  },
});
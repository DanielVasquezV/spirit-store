import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { LayoutChangeEvent, TextInputProps } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, ComposerMaxHeight, Gradient, Layout, Radius, Spacing, Type } from '@/constants/theme';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

const RING = 2;
const IDLE_SCALE = 2;
const IDLE_SPIN_MS = 9000;
const FOCUS_SPIN_MS = 2800;
const IDLE_BREATHE_MS = 5200;
const IDLE_BREATHE_SCALE = 2.16;
const CROSSFADE_MS = 220;

export function RainbowInput({ style, multiline, ...props }: TextInputProps) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(IDLE_SCALE);
  const focused = useSharedValue(0);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const startSpin = (duration: number) => {
    cancelAnimation(rotation);
    // Retoma el ángulo actual para no saltar al cambiar velocidad.
    rotation.value = withRepeat(
      withTiming(rotation.value + 360, { duration, easing: Easing.linear }),
      -1,
      false,
    );
  };

  const startIdleDetach = () => {
    cancelAnimation(scale);
    scale.value = withRepeat(
      withTiming(IDLE_BREATHE_SCALE, { duration: IDLE_BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  };

  useEffect(() => {
    startSpin(IDLE_SPIN_MS);
    startIdleDetach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  type FocusHandler = NonNullable<TextInputProps['onFocus']>;
  type BlurHandler = NonNullable<TextInputProps['onBlur']>;

  const focus: FocusHandler = (event) => {
    focused.value = withTiming(1, { duration: CROSSFADE_MS });
    startSpin(FOCUS_SPIN_MS);
    props.onFocus?.(event);
  };

  const blur: BlurHandler = (event) => {
    focused.value = withTiming(0, { duration: CROSSFADE_MS });
    startSpin(IDLE_SPIN_MS);
    startIdleDetach();
    props.onBlur?.(event);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const idleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focused.value, [0, 1], [1, 0]),
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  const wheelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focused.value, [0, 1], [0, 1]),
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Diámetro extra: un círculo cubre el píldora sin dejar huecos al girar.
  const wheel = Math.hypot(box.width, box.height) * 1.2;

  return (
    <View style={styles.ring} onLayout={onLayout}>
      <AnimatedGradient colors={[...Gradient.rainbow]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.idleGradient, idleStyle]} />
      {wheel > 0 ? (
        <AnimatedGradient
          colors={[...Gradient.rainbow]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            {
              position: 'absolute',
              width: wheel,
              height: wheel,
              borderRadius: wheel / 2,
              left: (box.width - wheel) / 2,
              top: (box.height - wheel) / 2,
            },
            wheelStyle,
          ]}
        />
      ) : null}
      <TextInput
        {...props}
        multiline={multiline}
        // En multilínea Enter inserta renglón; el envío va por el botón.
        blurOnSubmit={!multiline}
        scrollEnabled={multiline}
        textAlignVertical={multiline ? 'center' : undefined}
        style={[styles.input, multiline && styles.multiline, style]}
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
  idleGradient: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  input: {
    height: Layout.composerMinHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full - RING,
    backgroundColor: Colors.bg,
    ...Type.body,
    color: Colors.text,
    padding: 0,
  },
  multiline: {
    height: undefined,
    minHeight: Layout.composerMinHeight,
    maxHeight: ComposerMaxHeight,
    paddingVertical: Spacing.sm,
  },
});

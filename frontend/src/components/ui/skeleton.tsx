import { useEffect } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Colors, Radius } from '@/constants/theme';

type SkeletonProps = { width?: ViewStyle['width']; height?: number; radius?: number };

export function Skeleton({ width = '100%', height = 16, radius = Radius.xs }: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.8, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.block, { width, height, borderRadius: radius }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  block: { backgroundColor: Colors.overlay },
});

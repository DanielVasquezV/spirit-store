import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef } from 'react';
import type { ComponentProps } from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Colors, FontFamily, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { CART_COUNT } from '@/lib/mock-data';

type FeatherName = ComponentProps<typeof Feather>['name'];

const TAB_ICON: Record<string, FeatherName> = {
  index: 'home',
  explore: 'compass',
  cart: 'shopping-bag',
  profile: 'user',
};

const SHELL_RADIUS = Radius.xl;
const PAD = Spacing.xs + 2;
const SLIDE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
const SLIDE_DURATION = 340;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const slots = useRef<{ x: number; width: number }[]>([]);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const moveIndicator = (index: number) => {
    // Sin slot medido aún (primer render) no hay posición a la cual ir.
    const slot = slots.current[index];
    if (!slot) return;
    indicatorX.value = withTiming(slot.x, { duration: SLIDE_DURATION, easing: SLIDE_EASING });
    indicatorWidth.value = withTiming(slot.width, { duration: SLIDE_DURATION, easing: SLIDE_EASING });
  };

  useEffect(() => {
    // Navegación externa al tap (deep links, botones): se re-anima desde el índice real.
    moveIndicator(state.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  // Se pega al bottom conservando el gesture bar de iOS y la nav bar de Android.
  const bottomOffset = Math.max(insets.bottom - Spacing.sm, Spacing.xs);

  return (
    <View style={[styles.shell, { bottom: bottomOffset, borderRadius: SHELL_RADIUS }]}>
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const icon = TAB_ICON[route.name] ?? 'circle';

        const onPress = () => {
          // La pastilla responde al toque antes de que el navigator confirme el cambio.
          moveIndicator(index);
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const showBadge = route.name === 'cart' && CART_COUNT > 0;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            onLayout={(event) => {
              // Mide la posición real del item para animar sobre el ancho exacto.
              const { x, width } = event.nativeEvent.layout;
              slots.current[index] = { x, width };
              if (index === state.index) {
                indicatorX.value = x;
                indicatorWidth.value = width;
              }
            }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
            <View style={styles.iconWrap}>
              <Feather name={icon} size={24} color={focused ? Colors.text : Colors.textMuted} />
              {showBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{CART_COUNT}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: Layout.screenX,
    right: Layout.screenX,
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderWidth: Hairline,
    borderColor: Colors.border,
    padding: PAD,
    gap: PAD,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  indicator: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: 0,
    borderRadius: Radius.sm,
    backgroundColor: Colors.overlay,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    height: 56,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
  },
  itemPressed: { opacity: 0.6 },
  iconWrap: { position: 'relative' },
  label: { ...Type.labelSm, color: Colors.textMuted },
  labelFocused: { color: Colors.text },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: FontFamily.semibold,
    color: Colors.textInverse,
  },
});
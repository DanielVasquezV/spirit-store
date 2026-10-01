import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Type } from '@/constants/theme';

const LOGO_FULL = require('@/assets/images/logo.png');
const LOGO_MARK = require('@/assets/images/logo-mark.png');

// Proporciones de los PNG recortados: fijan el alto a partir del ancho sin medir la imagen en runtime.
const FULL_RATIO = 318 / 393;
const MARK_RATIO = 221 / 365;

type LogoProps = {
  variant?: 'mark' | 'full';
  width?: number;
  showWordmark?: boolean;
};

export function Logo({ variant = 'mark', width, showWordmark = true }: LogoProps) {
  if (variant === 'full') {
    const w = width ?? 200;
    return <Image source={LOGO_FULL} style={{ width: w, height: w * FULL_RATIO }} contentFit="contain" accessibilityLabel="Spirit Apex" />;
  }

  const w = width ?? 56;
  return (
    <View style={styles.row}>
      <Image source={LOGO_MARK} style={{ width: w, height: w * MARK_RATIO }} contentFit="contain" accessibilityLabel="Spirit Apex" />
      {showWordmark ? <Text style={styles.word}>Spirit Apex</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  word: { ...Type.h2, color: Colors.text },
});

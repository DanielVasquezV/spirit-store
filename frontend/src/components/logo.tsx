import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type LogoProps = {
  size?: 'sm' | 'lg';
  showWordmark?: boolean;
};

export function Logo({ size = 'sm', showWordmark = true }: LogoProps) {
  const mark = size === 'lg' ? 72 : 40;
  const iconSize = size === 'lg' ? 34 : 20;

  return (
    <View style={styles.row}>
      <View style={[styles.mark, { width: mark, height: mark, borderRadius: mark * 0.24 }]}>
        <Feather name="droplet" size={iconSize} color={Colors.textInverse} />
      </View>
      {showWordmark ? (
        <Text style={size === 'lg' ? styles.wordLg : styles.word}>Spirit Store</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mark: {
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: { ...Type.h2, color: Colors.text },
  wordLg: { ...Type.display, color: Colors.text },
});
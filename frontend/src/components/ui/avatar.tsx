import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Colors, FontFamily } from '@/constants/theme';

type AvatarProps = { name: string; size?: number; uri?: string };

const PALETTE = [Colors.overlayPressed, Colors.info, Colors.success, Colors.warning, Colors.danger];

// Iniciales del nombre para usarlas como avatar cuando no hay foto.
function initialsOf(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, size = 40, uri }: AvatarProps) {
  const radius = size / 2;
  // Color de fondo estable por persona: mismo nombre, mismo tono.
  const hue = PALETTE[name.length % PALETTE.length];

  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius }} />;
  }

  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: radius, backgroundColor: hue }]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: FontFamily.bold, color: Colors.text },
});
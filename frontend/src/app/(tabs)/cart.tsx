import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Spacing, Type } from '@/constants/theme';

export default function CartScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Carrito" right={<View />} />
      <View style={[styles.empty, { paddingBottom: 96 + insets.bottom }]}>
        <View style={styles.iconWrap}>
          <Feather name="shopping-bag" size={44} color={Colors.textMuted} />
        </View>
        <Text style={styles.title}>Tu carrito está vacío</Text>
        <Text style={styles.body}>Los vehículos que guardes aparecerán acá listos para cerrar la compra.</Text>
        <Button
          label="Explorar vehículos"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/explore')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xxl },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: { ...Type.h2, color: Colors.text, textAlign: 'center' },
  body: { ...Type.body, color: Colors.textSecondary, textAlign: 'center' },
});
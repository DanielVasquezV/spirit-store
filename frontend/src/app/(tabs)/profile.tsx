import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';

const MENU_ITEMS = ['Publicar un vehículo', 'Mis vehículos', 'Subastas seguidas', 'Notificaciones', 'Ajustes'];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Perfil" right={<View />} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Feather name="user" size={32} color={Colors.textMuted} />
          </View>
          <Text style={styles.name}>Invitado</Text>
          <Text style={styles.meta}>Aún no iniciás sesión</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Iniciar sesión" fullWidth onPress={() => router.push('/login')} />
          <Button label="Crear cuenta" variant="secondary" fullWidth onPress={() => router.push('/register')} />
        </View>

        <Text style={styles.sectionLabel}>Verificación</Text>
        <View style={styles.card}>
          <View style={styles.docRow}>
            <View style={styles.docIcon}>
              <Feather name="file-text" size={20} color={Colors.text} />
            </View>
            <View style={styles.docInfo}>
              <Text style={styles.docTitle}>Documento DUI</Text>
              <Text style={styles.docSub}>Se usa para publicar tus vehículos</Text>
            </View>
            <Badge label="Pendiente" />
          </View>
          <Button label="Subir documento" variant="secondary" fullWidth onPress={() => {}} />
        </View>

        <Text style={styles.sectionLabel}>Actividad</Text>
        <View style={styles.card}>
          {MENU_ITEMS.map((item, index) => (
            <View key={item} style={[styles.menuRow, index < MENU_ITEMS.length - 1 && styles.menuRowBorder]}>
              <Text style={styles.menuLabel}>{item}</Text>
              <Feather name="chevron-right" size={20} color={Colors.textMuted} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.md },
  identity: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xl },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Type.h2, color: Colors.text, marginTop: Spacing.sm },
  meta: { ...Type.caption, color: Colors.textMuted },
  actions: { gap: Spacing.sm, marginTop: Spacing.lg },
  sectionLabel: {
    ...Type.label,
    color: Colors.textMuted,
    marginTop: Spacing.xxxl,
    marginBottom: Spacing.sm,
  },
  card: {
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: Layout.cardPadding,
    gap: Spacing.lg,
  },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: { flex: 1, gap: Spacing.xs },
  docTitle: { ...Type.bodyStrong, color: Colors.text },
  docSub: { ...Type.caption, color: Colors.textMuted },
  menuRow: {
    height: Layout.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuRowBorder: { borderBottomWidth: Hairline, borderBottomColor: Colors.border },
  menuLabel: { ...Type.body, color: Colors.text },
});
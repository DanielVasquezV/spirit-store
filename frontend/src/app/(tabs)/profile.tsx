import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useRequireAuth } from '@/features/auth/use-require-auth';
import { useDuiUpload } from '@/features/profile/use-dui-upload';
import { DUI_STATUS_LABELS } from '@/lib/taxonomy';

type MenuItem = { label: string; icon: ComponentProps<typeof Feather>['name']; href?: Href };

// Notificaciones y Ajustes no tienen backend todavía: quedan visibles pero deshabilitados.
const MENU_ITEMS: MenuItem[] = [
  { label: 'Publicar un vehículo', icon: 'plus-square', href: '/vehicle/new' },
  { label: 'Mis vehículos', icon: 'truck', href: '/my-vehicles' },
  { label: 'Subastas seguidas', icon: 'activity', href: '/my-bids' },
  { label: 'Mis compras y ventas', icon: 'shopping-bag', href: '/purchases' },
  { label: 'Notificaciones', icon: 'bell' },
  { label: 'Ajustes', icon: 'settings' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useSession();
  const { requireAuth } = useRequireAuth();
  const dui = useDuiUpload();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Perfil" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Feather name="user" size={32} color={Colors.textMuted} />
          </View>
          <Text style={styles.name}>{user ? user.fullName : 'Invitado'}</Text>
          <Text style={styles.meta}>{user ? user.email : 'Navegás sin cuenta: para comprar, pujar o chatear necesitás iniciar sesión'}</Text>
          {user?.phoneNumber ? <Text style={styles.meta}>{user.phoneNumber}</Text> : null}
        </View>

        {user ? (
          <View style={styles.actions}>
            <Button label="Editar perfil" variant="secondary" fullWidth onPress={() => router.push('/profile-edit')} />
            {/* Cerrar sesión deja al usuario como invitado en la misma pantalla: la app sigue navegable sin cuenta. */}
            <Button label="Cerrar sesión" variant="ghost" fullWidth onPress={() => void signOut()} />
          </View>
        ) : (
          <View style={styles.actions}>
            <Button label="Iniciar sesión" fullWidth onPress={() => router.push('/login')} />
            <Button label="Crear cuenta" variant="secondary" fullWidth onPress={() => router.push('/register')} />
          </View>
        )}

        {user ? (
          <>
            <Text style={styles.sectionLabel}>Verificación</Text>
            <View style={styles.card}>
              <View style={styles.docRow}>
                <View style={styles.docIcon}>
                  <Feather name="file-text" size={20} color={Colors.text} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle}>Documento DUI</Text>
                  <Text style={styles.docSub}>Se usa para publicar tus vehículos y pujar</Text>
                </View>
                <Badge label={DUI_STATUS_LABELS[user.duiStatus]} tone={user.duiStatus === 'VERIFIED' ? 'accent' : 'neutral'} />
              </View>
              {dui.error ? <Text style={styles.error}>{dui.error}</Text> : null}
              <Button
                label={dui.uploading ? 'Subiendo…' : dui.loaded ? 'Reemplazar documento' : 'Subir documento'}
                variant="secondary"
                fullWidth
                disabled={dui.uploading}
                onPress={() => void dui.pickAndSave()}
              />
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Herramientas</Text>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/diagnostics')}
            style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
            <View style={styles.toolRow}>
              <View style={[styles.docIcon, { backgroundColor: Colors.warning }]}>
                <Feather name="cpu" size={20} color={Colors.textInverse} />
              </View>
              <View style={styles.toolInfo}>
                <Text style={styles.toolTitle}>Asistente APEX</Text>
                <Text style={styles.toolSub}>Diagnosticá fallas o pedí recomendaciones de autos del catálogo</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Actividad</Text>
        <View style={styles.card}>
          {MENU_ITEMS.map((item, index) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              disabled={!item.href}
              onPress={() => item.href && requireAuth(() => router.push(item.href!))}
              style={({ pressed }) => [styles.menuRow, index < MENU_ITEMS.length - 1 && styles.menuRowBorder, pressed && styles.pressed]}>
              <Text style={[styles.menuLabel, !item.href && styles.menuLabelDisabled]}>{item.label}</Text>
              {item.href ? <Feather name="chevron-right" size={20} color={Colors.textMuted} /> : <Text style={styles.soon}>Próximamente</Text>}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
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
  menuLabelDisabled: { color: Colors.textMuted },
  soon: { ...Type.labelSm, color: Colors.textMuted },
  error: { ...Type.caption, color: Colors.danger },
  pressed: { opacity: 0.7 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  toolInfo: { flex: 1, gap: Spacing.xs },
  toolTitle: { ...Type.bodyStrong, color: Colors.text },
  toolSub: { ...Type.caption, color: Colors.textMuted },
});
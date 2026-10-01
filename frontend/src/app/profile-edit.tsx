import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StickyCta } from '@/components/ui/sticky-cta';
import { Colors, Layout, Spacing, Type } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { fieldErrors, messageFor } from '@/lib/api/api-error';

export default function ProfileEditScreen() {
  const { user, updateProfile } = useSession();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phoneNumber ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await updateProfile({ fullName: fullName.trim(), phoneNumber: phone.trim() || null });
      router.back();
    } catch (error) {
      setErrors(fieldErrors(error));
      setFormError(messageFor(error, 'No pudimos guardar los cambios.'));
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Editar perfil" onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Field label="Nombre completo" value={fullName} onChangeText={setFullName} error={errors.fullName} autoCapitalize="words" />
        {/* El backend reporta el error de teléfono como `phone` aunque el campo se llame phoneNumber. */}
        <Field label="Teléfono" value={phone} onChangeText={setPhone} error={errors.phone ?? errors.phoneNumber} keyboardType="phone-pad" />
        <Field label="Correo electrónico" value={user?.email ?? ''} editable={false} helper="El correo no se puede cambiar." />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
      </ScrollView>
      </KeyboardAvoidingView>
      <StickyCta>
        <Button label={saving ? 'Guardando…' : 'Guardar cambios'} fullWidth size="lg" disabled={saving} onPress={() => void save()} />
      </StickyCta>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  content: { padding: Layout.screenX, gap: Spacing.lg, paddingBottom: Layout.ctaBarHeight + Spacing.giant },
  error: { ...Type.caption, color: Colors.danger },
});

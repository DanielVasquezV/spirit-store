import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StickyCta } from '@/components/ui/sticky-cta';
import { useSession } from '@/features/auth/session-provider';
import { fieldErrors, messageFor } from '@/lib/api/api-error';
import { hasErrors, validateLogin, type FieldErrors } from '@/lib/validation';
import { Colors, Layout, Spacing, Type } from '@/constants/theme';

export default function LoginScreen() {
  const { status, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Se vuelve a la pantalla que pidió la cuenta; si se abrió directo, a Home.
    if (status === 'authenticated') {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    }
  }, [status]);

  const handleSubmit = async () => {
    const found = validateLogin({ email, password });
    setErrors(found);
    if (hasErrors(found)) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await signIn({ email: email.trim(), password });
    } catch (error) {
      // Los errores por campo del servidor pisan los del cliente: el backend sabe si el correo existe.
      setErrors((current) => ({ ...current, ...fieldErrors(error) }));
      setFormError(messageFor(error, 'No pudimos iniciar sesión.'));
      setSubmitting(false);
    }
  };


  return (
    <View style={styles.screen}>
      <ScreenHeader title="Iniciar sesión" onBack={() => router.back()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <Logo variant="full" width={160} />
        </View>
        <Text style={styles.lead}>Accedé a tu cuenta para seguir con tu búsqueda</Text>

        <View style={styles.form}>
          <Field
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="tucorreo@ejemplo.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            error={errors.email}
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            error={errors.password}
          />
          {/* El backend no expone recuperación de contraseña todavía: se avisa en vez de dejar un control muerto. */}
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setFormError('La recuperación de contraseña todavía no está disponible.')}
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
          </Pressable>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>¿No tenés cuenta?</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push('/register')}
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.link}>Crear cuenta</Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <StickyCta>
        <Button label="Iniciar sesión" size="lg" fullWidth onPress={handleSubmit} disabled={submitting} />
      </StickyCta>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Layout.screenX,
    paddingTop: Spacing.md,
    paddingBottom: Layout.ctaBarHeight + Spacing.giant,
    gap: Spacing.xxl,
  },
  brand: { alignItems: 'center', paddingVertical: Spacing.md },
  lead: { ...Type.bodySm, color: Colors.textMuted },
  form: { gap: Spacing.lg },
  formError: { ...Type.caption, color: Colors.danger },
  link: { ...Type.bodyStrong, color: Colors.text },
  switchRow: { flexDirection: 'row', gap: Spacing.xs + 2, justifyContent: 'center', alignItems: 'center' },
  switchText: { ...Type.caption, color: Colors.textMuted },
  pressed: { opacity: 0.6 },
});
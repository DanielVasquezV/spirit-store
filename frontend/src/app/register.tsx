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
import { hasErrors, validateRegister, type FieldErrors } from '@/lib/validation';
import { Colors, Layout, Spacing, Type } from '@/constants/theme';

export default function RegisterScreen() {
  const { status, signUp } = useSession();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
    const found = validateRegister({ fullName, email, phone, password, confirm });
    setErrors(found);
    if (hasErrors(found)) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await signUp({ email: email.trim(), fullName: fullName.trim(), password, phoneNumber: phone.trim() });
    } catch (error) {
      setErrors((current) => ({ ...current, ...fieldErrors(error) }));
      setFormError(messageFor(error, 'No pudimos crear la cuenta.'));
      setSubmitting(false);
    }
  };


  return (
    <View style={styles.screen}>
      <ScreenHeader title="Crear cuenta" onBack={() => router.back()} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        <View style={styles.brand}>
          <Logo variant="full" width={160} />
        </View>
        <Text style={styles.lead}>Comprá o vendé: una sola cuenta para ambas cosas</Text>

        <View style={styles.form}>
          <Field
            label="Nombre completo"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Nombre y apellido"
            autoComplete="name"
            error={errors.fullName}
          />
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
            label="Teléfono"
            value={phone}
            onChangeText={setPhone}
            placeholder="+503 7000 0000+5"
            autoCapitalize="none"
            autoComplete="tel"
            keyboardType="phone-pad"
            error={errors.phone}
          />
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 8 caracteres"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            error={errors.password}
          />
          <Field
            label="Confirmar contraseña"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repetí tu contraseña"
            secureTextEntry
            autoComplete="password-new"
            error={errors.confirm}
          />
          <Text style={styles.note}>
            Cuando publiques un vehículo te pediremos el número VIN, la placa y tu documento DUI
            para verificar la venta.
          </Text>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>¿Ya tenés cuenta?</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push('/login')}
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.link}>Iniciar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <StickyCta>
        <Button label="Crear cuenta" size="lg" fullWidth onPress={handleSubmit} disabled={submitting} />
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
  note: { ...Type.caption, color: Colors.textMuted },
  form: { gap: Spacing.lg },
  formError: { ...Type.caption, color: Colors.danger },
  link: { ...Type.bodyStrong, color: Colors.text },
  switchRow: { flexDirection: 'row', gap: Spacing.xs + 2, justifyContent: 'center', alignItems: 'center' },
  switchText: { ...Type.caption, color: Colors.textMuted },
  pressed: { opacity: 0.6 },
});
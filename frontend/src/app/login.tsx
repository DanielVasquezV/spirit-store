import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StickyCta } from '@/components/ui/sticky-cta';
import { Colors, Layout, Spacing, Type } from '@/constants/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = { email?: string; password?: string };

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const next: Errors = {};
    if (!EMAIL_RE.test(email)) next.email = 'Ingresá un correo electrónico válido';
    if (password.length < 8) next.password = 'La contraseña debe tener al menos 8 caracteres';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setSubmitting(true);
    // Mock del round-trip de auth: aquí se conectará el servicio de login real.
    setTimeout(() => router.replace('/(tabs)'), 700);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Iniciar sesión" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
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
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {}}
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
          </Pressable>
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

      <StickyCta>
        <Button label="Iniciar sesión" size="lg" fullWidth onPress={handleSubmit} disabled={submitting} />
      </StickyCta>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: {
    paddingHorizontal: Layout.screenX,
    paddingTop: Spacing.md,
    paddingBottom: Layout.ctaBarHeight + Spacing.giant,
    gap: Spacing.xxl,
  },
  lead: { ...Type.bodySm, color: Colors.textMuted },
  form: { gap: Spacing.lg },
  link: { ...Type.bodyStrong, color: Colors.text },
  switchRow: { flexDirection: 'row', gap: Spacing.xs + 2, justifyContent: 'center', alignItems: 'center' },
  switchText: { ...Type.caption, color: Colors.textMuted },
  pressed: { opacity: 0.6 },
});
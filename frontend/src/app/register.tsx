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
const PHONE_RE = /^[+\d][\d\s-]{6,}$/;

type Errors = { fullName?: string; email?: string; phone?: string; password?: string; confirm?: string };

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const next: Errors = {};
    if (fullName.trim().length < 3) next.fullName = 'Ingresá tu nombre completo';
    if (!EMAIL_RE.test(email)) next.email = 'Ingresá un correo electrónico válido';
    if (!PHONE_RE.test(phone)) next.phone = 'Ingresá un número de teléfono válido';
    if (password.length < 8) next.password = 'La contraseña debe tener al menos 8 caracteres';
    if (confirm !== password) next.confirm = 'Las contraseñas no coinciden';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    setSubmitting(true);
    // Mock del registro: aquí se enviarán full_name, email, phone y password al endpoint real.
    setTimeout(() => router.replace('/(tabs)'), 700);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Crear cuenta" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
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
            placeholder="+1 555 000 1234"
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
            autoCapitalize="none"
            autoComplete="password-new"
            error={errors.confirm}
          />
          <Text style={styles.note}>
            Cuando publiques un vehículo te pediremos el número VIN, la placa y tu documento DUI
            para verificar la venta.
          </Text>
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

      <StickyCta>
        <Button label="Crear cuenta" size="lg" fullWidth onPress={handleSubmit} disabled={submitting} />
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
  note: { ...Type.caption, color: Colors.textMuted },
  form: { gap: Spacing.lg },
  link: { ...Type.bodyStrong, color: Colors.text },
  switchRow: { flexDirection: 'row', gap: Spacing.xs + 2, justifyContent: 'center', alignItems: 'center' },
  switchText: { ...Type.caption, color: Colors.textMuted },
  pressed: { opacity: 0.6 },
});
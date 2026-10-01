import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Colors, Spacing, Type } from '@/constants/theme';

type SignInPromptProps = {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  body: string;
  onSignIn: () => void;
  onRegister: () => void;
};

// Lo que ve un invitado en una sección que necesita cuenta: explica para qué y ofrece entrar o registrarse.
export function SignInPrompt({ icon, title, body, onSignIn, onRegister }: SignInPromptProps) {
  return (
    <View style={styles.wrap}>
      <Feather name={icon} size={40} color={Colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.actions}>
        <Button label="Iniciar sesión" fullWidth onPress={onSignIn} />
        <Button label="Crear cuenta" variant="secondary" fullWidth onPress={onRegister} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.huge, paddingHorizontal: Spacing.xxl },
  title: { ...Type.h3, color: Colors.text, textAlign: 'center' },
  body: { ...Type.body, color: Colors.textMuted, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.sm },
});

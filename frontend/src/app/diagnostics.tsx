import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { RainbowInput } from '@/components/rainbow-input';
import { Button } from '@/components/ui/button';
import { RecommendedVehicle } from '@/components/recommended-vehicle';
import { Chip } from '@/components/ui/chip';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { useRequireAuth } from '@/features/auth/use-require-auth';
import { useDiagnosticChat, useDiagnosticsAvailability } from '@/features/diagnostics/use-diagnostic-chat';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { SEVERITY_LABELS } from '@/lib/taxonomy';

// Atajos para arrancar: cubren las tres cosas que sabe hacer el asistente.
const SUGGESTIONS = [
  'Mi carro chilla al frenar',
  'Recomendame un SUV familiar hasta $35,000',
  '¿Cada cuánto cambio el aceite?',
];

export default function DiagnosticsScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const { keyboardHeight, barPaddingBottom } = useKeyboardInset();
  const { isGuest, requireAuth } = useRequireAuth();
  const availability = useDiagnosticsAvailability(!isGuest);
  const chat = useDiagnosticChat(vehicleId);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const unavailable = availability.data?.available === false;

  const { entries } = chat;

  const send = (preset?: string) =>
    requireAuth(() => {
      const text = (preset ?? draft).trim();
      if (!text || chat.thinking || unavailable) return;
      setDraft('');
      void chat.send(text);
    });

  const severity = chat.diagnostic?.severity;
  const subtitle = severity ? `Severidad ${SEVERITY_LABELS[severity].toLowerCase()}` : 'Fallas y recomendaciones';

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Asistente APEX" subtitle={subtitle} onBack={() => router.back()} />

      <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.thread, { paddingBottom: Spacing.md }]}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          {entries.map((entry) => {
            const own = entry.from === 'me';
            return (
              <View key={entry.id} style={[styles.bubbleRow, own ? styles.bubbleRowOwn : styles.bubbleRowBot]}>
                {!own ? (
                  <View style={styles.botIcon}>
                    <Feather name="cpu" size={16} color={Colors.textInverse} />
                  </View>
                ) : null}
                <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleBot]}>
                  <Text style={styles.bubbleText}>{entry.text}</Text>
                  {entry.recommendations?.length ? (
                    <View style={styles.recommendations}>
                      <Text style={styles.recommendationsLabel}>Del catálogo de Spirit Apex</Text>
                      {entry.recommendations.map((vehicle) => (
                        <RecommendedVehicle key={vehicle.id} vehicle={vehicle} />
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
          {chat.messages.length === 0 && !chat.pending && !unavailable ? (
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <Chip key={suggestion} label={suggestion} onPress={() => send(suggestion)} />
              ))}
            </View>
          ) : null}
          {chat.thinking ? (
            <View style={[styles.bubbleRow, styles.bubbleRowBot]}>
              <View style={styles.botIcon}>
                <Feather name="cpu" size={16} color={Colors.textInverse} />
              </View>
              <View style={[styles.bubble, styles.bubbleBot]}>
                <Text style={styles.bubbleText}>Pensando…</Text>
              </View>
            </View>
          ) : null}
          {chat.error ? <Text style={styles.error}>{chat.error}</Text> : null}
          {unavailable ? <Text style={styles.error}>El asistente no está disponible en este servidor (falta GROQ_API_KEY).</Text> : null}
        </ScrollView>

        {isGuest ? (
          <StickyBar bottomInset={barPaddingBottom}>
            <Button label="Iniciá sesión para consultar al asistente" fullWidth size="lg" onPress={() => router.push('/login')} />
          </StickyBar>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: barPaddingBottom }]}>
            <RainbowInput
              value={draft}
              onChangeText={setDraft}
              placeholder={chat.diagnostic ? 'Hacé una pregunta de seguimiento…' : 'Describí el síntoma…'}
              multiline
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Consultar"
              disabled={!draft.trim() || chat.thinking || unavailable}
              onPress={() => send()}
              style={({ pressed }) => [styles.send, (!draft.trim() || chat.thinking || unavailable) && styles.sendDisabled, pressed && styles.sendPressed]}>
              <Feather name="arrow-up" size={20} color={draft.trim() && !chat.thinking ? Colors.textInverse : Colors.textMuted} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// Barra inferior con el mismo borde y respiro que la del input, para que la pantalla no salte al iniciar sesión.
function StickyBar({ bottomInset, children }: { bottomInset: number; children: ReactNode }) {
  return <View style={[styles.inputBar, { paddingBottom: Math.max(bottomInset, Spacing.sm) }]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  thread: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.lg, gap: Spacing.sm },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleRowBot: { justifyContent: 'flex-start' },
  botIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: { maxWidth: '80%', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  bubbleOwn: { backgroundColor: Colors.bubbleSelf, borderBottomRightRadius: Radius.xs },
  bubbleBot: { backgroundColor: Colors.surface, borderWidth: Hairline, borderColor: Colors.bubbleIncomingBorder, borderBottomLeftRadius: Radius.xs },
  bubbleText: { ...Type.body, color: Colors.text },
  error: { ...Type.caption, color: Colors.danger, textAlign: 'center', marginTop: Spacing.sm },
  recommendations: { gap: Spacing.sm, marginTop: Spacing.md },
  recommendationsLabel: { ...Type.labelSm, color: Colors.textMuted },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingLeft: 28 + Spacing.sm },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Layout.screenX,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.bg,
    borderTopWidth: Hairline,
    borderTopColor: Colors.border,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPressed: { backgroundColor: Colors.accentPressed },
  sendDisabled: { backgroundColor: Colors.overlay },
});
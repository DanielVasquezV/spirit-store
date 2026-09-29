import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { RainbowInput } from '@/components/rainbow-input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';

type ChatEntry = { id: string; from: 'me' | 'bot'; text: string };

const INTRO: ChatEntry = {
  id: 'intro',
  from: 'bot',
  text: 'Hola, soy el asistente de diagnóstico. Contame qué le escuchás o sentís a tu vehículo y te oriento con posibles causas.',
};

const ANSWERS: { keys: string[]; text: string }[] = [
  { keys: ['freno', 'frenos'], text: 'El desgaste de pastillas suele generar chillidos. Revisá también el nivel de líquido de frenos y el disco por surcos. Si el pedal va "esponjoso", purgá el sistema.' },
  { keys: ['bateria', 'batería', 'arranca', 'arranqu', 'encendid', 'luces'], text: 'Un arranque lento o luces débiles apuntan a la batería o al alternador. Medí el voltaje en frío (debería estar sobre 12.4V) y revisá bornes por sulfatación.' },
  { keys: ['ruido', 'sonid', 'ronca', 'tac'], text: 'Según el momento del ruido puede ser distinto: al frenar es fricción; al girar puede ser de suspensión o rodamiento; al acelerar, de motor o escape. Aislá cuándo aparece y focalizá ahí.' },
  { keys: ['humo', 'tira humo'], text: 'Humo azul = quema aceite (anillos o guías de válvula); gris oscuro = mezcla rica o inyectores; blanco abundante = refrigerante entrando por la junta de tapa. Cada color apunta distinto.' },
  { keys: ['aceite', 'nivel'], text: 'El aceite debe leerse con el motor frío y en superficie plana. Si el testigo enciende en marcha, parate en seguida: puede ser presión baja y el motor se daña rápido.' },
  { keys: ['vibra', 'tembla', 'al volante'], text: 'Si vibra solo al frenar puede ser disco alabeado; si es a velocidad constante, balanceo o llantas. También podés verificar los bujes de suspensión delantera.' },
];

const FALLBACK = 'Anoté el síntoma. Si podés precisarme cuándo aparece (en frío, al frenar, en curva) y qué color/luz ves, te afino el diagnóstico. Igual, para fallas graves siempre conviene un mecánico con escáner.';

function matchAnswer(text: string): string {
  const haystack = text.toLocaleLowerCase();
  return ANSWERS.find(({ keys }) => keys.some((key) => haystack.includes(key)))?.text ?? FALLBACK;
}

export default function DiagnosticsScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<ChatEntry[]>([INTRO]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = () => {
    const text = draft.trim();
    if (!text || thinking) return;
    setEntries((current) => [...current, { id: `me-${Date.now()}`, from: 'me', text }]);
    setDraft('');
    setThinking(true);

    // Latencia simulada del modelo: primero "piensa", luego responde.
    setTimeout(() => {
      setEntries((current) => [...current, { id: `bot-${Date.now()}`, from: 'bot', text: matchAnswer(text) }]);
      setThinking(false);
    }, 1100);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Diagnóstico IA" subtitle="Asistente de fallas" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.thread, { paddingBottom: Spacing.md }]}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
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
                </View>
              </View>
            );
          })}
          {thinking ? (
            <View style={[styles.bubbleRow, styles.bubbleRowBot]}>
              <View style={styles.botIcon}>
                <Feather name="cpu" size={16} color={Colors.textInverse} />
              </View>
              <View style={[styles.bubble, styles.bubbleBot]}>
                <Text style={styles.bubbleText}>Analizando síntomas…</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
        <RainbowInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Describí el síntoma…"
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Consultar"
          disabled={!draft.trim() || thinking}
          onPress={send}
          style={({ pressed }) => [styles.send, (!draft.trim() || thinking) && styles.sendDisabled, pressed && styles.sendPressed]}>
          <Feather name="arrow-up" size={20} color={draft.trim() && !thinking ? Colors.textInverse : Colors.textMuted} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
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
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
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
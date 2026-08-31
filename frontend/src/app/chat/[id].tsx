import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Avatar } from '@/components/ui/avatar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { CHAT_THREADS, getProductById, type ChatMessage } from '@/lib/mock-data';

const AUTO_REPLIES = [
  '¡Perfecto! ¿Te parece una prueba de manejo el fin de semana?',
  'Buena pregunta, te confirmo los detalles por acá.',
  'Entiendo, dejame revisar los documentos y te escribo.',
  'Genial, lo seguimos coordinando por este chat.',
];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const thread = CHAT_THREADS.find((item) => item.id === id);
  const [messages, setMessages] = useState<ChatMessage[]>(thread?.messages ?? []);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const replyIndex = useRef(0);

  useEffect(() => {
    if (!thread) return;
    setMessages(thread.messages);
  }, [thread]);

  if (!thread) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Conversación no encontrada</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const product = getProductById(thread.vehicleId);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const message: ChatMessage = { id: `me-${Date.now()}`, from: 'me', text, time: 'Ahora' };
    setMessages((current) => [...current, message]);
    setDraft('');
    scheduleReply();
  };

  // Respuesta simulada de la contraparte para que el hilo se sienta vivo.
  const scheduleReply = () => {
    setTyping(true);
    const delay = 1400 + Math.random() * 700;
    setTimeout(() => {
      setTyping(false);
      const reply: ChatMessage = {
        id: `peer-${Date.now()}`,
        from: 'peer',
        text: AUTO_REPLIES[replyIndex.current % AUTO_REPLIES.length],
        time: 'Ahora',
      };
      replyIndex.current += 1;
      setMessages((current) => [...current, reply]);
    }, delay);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const own = item.from === 'me';
    return (
      <View style={[styles.bubbleRow, own ? styles.bubbleRowOwn : styles.bubbleRowPeer]}>
        {!own ? <Avatar name={thread.peerName} size={28} /> : null}
        <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubblePeer]}>
          <Text style={styles.bubbleText}>{item.text}</Text>
          <Text style={[styles.bubbleTime, own ? styles.bubbleTimeOwn : styles.bubbleTimePeer]}>{item.time}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader
        title={product?.title ?? 'Chat'}
        subtitle={`${thread.peerName} · ${thread.type === 'buy' ? 'Comprando' : 'Vendiendo'}`}
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(message) => message.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.messages, { paddingBottom: Spacing.md }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            typing ? (
              <View style={[styles.bubbleRow, styles.bubbleRowPeer]}>
                <Avatar name={thread.peerName} size={28} />
                <View style={[styles.bubble, styles.bubblePeer]}>
                  <Text style={styles.typingText}>Escribiendo…</Text>
                </View>
              </View>
            ) : null
          }
        />
      </KeyboardAvoidingView>

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Escribí un mensaje…"
            placeholderTextColor={Colors.textMuted}
            selectionColor={Colors.text}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={send}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          disabled={!draft.trim()}
          onPress={send}
          style={({ pressed }) => [styles.send, !draft.trim() && styles.sendDisabled, pressed && styles.sendPressed]}>
          <Feather name="arrow-up" size={20} color={draft.trim() ? Colors.textInverse : Colors.textMuted} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  missingText: { ...Type.h2, color: Colors.text },
  backText: { ...Type.bodyStrong, color: Colors.accent },
  messages: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.lg, gap: Spacing.sm },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleRowPeer: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  bubbleOwn: { backgroundColor: Colors.bubbleSelf, borderBottomRightRadius: Radius.xs },
  bubblePeer: { backgroundColor: Colors.surface, borderWidth: Hairline, borderColor: Colors.bubbleIncomingBorder, borderBottomLeftRadius: Radius.xs },
  bubbleText: { ...Type.body, color: Colors.text },
  bubbleTime: { ...Type.caption, marginTop: 2, alignSelf: 'flex-end' },
  bubbleTimeOwn: { color: Colors.textSecondary },
  bubbleTimePeer: { color: Colors.textMuted },
  typingText: { ...Type.bodySm, color: Colors.textSecondary },
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
  inputWrap: {
    flex: 1,
    height: 44,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.overlay,
    borderRadius: Radius.full,
    borderWidth: Hairline,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  input: { ...Type.body, color: Colors.text, padding: 0 },
  send: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPressed: { backgroundColor: Colors.accentPressed },
  sendDisabled: { backgroundColor: Colors.overlay },
});
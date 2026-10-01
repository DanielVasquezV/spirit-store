import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, ComposerMaxHeight, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { useSession } from '@/features/auth/session-provider';
import { threadSubtitle } from '@/features/chats/chat-rules';
import { useLiveChat } from '@/features/chats/use-chats';
import { messageFor } from '@/lib/api/api-error';
import { formatChatTime } from '@/lib/format';
import type { ChatMessageDto } from '@/lib/types/api';

// Burbujas fantasma mientras llega el historial: mismo radio que las reales, alternando los lados.
function MessagesSkeleton() {
  return (
    <View style={styles.skeleton}>
      {['62%', '48%', '70%'].map((width, index) => (
        <View key={width} style={index % 2 ? styles.bubbleRowOwn : styles.bubbleRowPeer}>
          <Skeleton width={width as `${number}%`} height={Layout.touchMin} radius={Radius.md} />
        </View>
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { keyboardHeight, barPaddingBottom } = useKeyboardInset();
  const { user } = useSession();
  const { messages, items: ordered, thread, send } = useLiveChat(id, user?.id);
  const [draft, setDraft] = useState('');

  if (messages.isError && !thread) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Conversación no encontrada</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const peerName = thread?.counterpart.fullName ?? 'Chat';

  const submit = () => {
    const text = draft.trim();
    if (!text || send.isPending) return;
    send.mutate(text, { onSuccess: () => setDraft('') });
  };

  const renderMessage = ({ item }: { item: ChatMessageDto }) => {
    const own = item.senderId === user?.id;
    return (
      <View style={[styles.bubbleRow, own ? styles.bubbleRowOwn : styles.bubbleRowPeer]}>
        {!own ? <Avatar name={item.senderName} size={28} /> : null}
        <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubblePeer]}>
          <Text style={styles.bubbleText}>{item.content}</Text>
          <Text style={[styles.bubbleTime, own ? styles.bubbleTimeOwn : styles.bubbleTimePeer]}>
            {formatChatTime(item.createdAt)}
            {own && item.isRead ? ' · Visto' : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={thread?.vehicle?.title ?? 'Chat'}
        subtitle={thread ? threadSubtitle(thread) : undefined}
        onBack={() => router.back()}
        right={
          thread?.vehicle ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Ver vehículo" hitSlop={8} onPress={() => router.push(`/product/${thread.vehicle!.id}`)}>
              <Feather name="external-link" size={20} color={Colors.textMuted} />
            </Pressable>
          ) : undefined
        }
      />

      <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>
        {/* Invertida: la API entrega lo más nuevo primero y así el hilo arranca abajo sin scrollToEnd. */}
        <FlatList
          inverted
          data={ordered}
          keyExtractor={(message) => message.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.messages, { paddingTop: Spacing.md }]}
          onEndReached={() => {
            if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={messages.isPending || messages.isFetchingNextPage ? <MessagesSkeleton /> : null}
          ListEmptyComponent={
            messages.isSuccess ? <Text style={styles.emptyText}>Escribí el primer mensaje para {peerName}.</Text> : null
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        />

        {send.error ? <Text style={styles.sendError}>{messageFor(send.error, 'No se pudo enviar el mensaje.')}</Text> : null}
        <View style={[styles.inputBar, { paddingBottom: barPaddingBottom }]}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribí un mensaje…"
              placeholderTextColor={Colors.textMuted}
              selectionColor={Colors.text}
              multiline
              blurOnSubmit={false}
              scrollEnabled
              textAlignVertical="center"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            disabled={!draft.trim() || send.isPending}
            onPress={submit}
            style={({ pressed }) => [styles.send, (!draft.trim() || send.isPending) && styles.sendDisabled, pressed && styles.sendPressed]}>
            <Feather name="arrow-up" size={20} color={draft.trim() && !send.isPending ? Colors.textInverse : Colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
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
  skeleton: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleRowPeer: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  bubbleOwn: { backgroundColor: Colors.bubbleSelf, borderBottomRightRadius: Radius.xs },
  bubblePeer: { backgroundColor: Colors.surface, borderWidth: Hairline, borderColor: Colors.bubbleIncomingBorder, borderBottomLeftRadius: Radius.xs },
  bubbleText: { ...Type.body, color: Colors.text },
  bubbleTime: { ...Type.caption, marginTop: 2, alignSelf: 'flex-end' },
  bubbleTimeOwn: { color: Colors.textSecondary },
  bubbleTimePeer: { color: Colors.textMuted },
  emptyText: { ...Type.body, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.huge, transform: [{ scaleY: -1 }] },
  sendError: { ...Type.caption, color: Colors.danger, paddingHorizontal: Layout.screenX, paddingBottom: Spacing.xs },
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
  inputWrap: {
    flex: 1,
    minHeight: Layout.composerMinHeight,
    maxHeight: ComposerMaxHeight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.overlay,
    borderRadius: Radius.full,
    borderWidth: Hairline,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  input: {
    ...Type.body,
    color: Colors.text,
    padding: 0,
    maxHeight: ComposerMaxHeight - Spacing.sm * 2,
  },
  send: {
    width: Layout.composerMinHeight,
    height: Layout.composerMinHeight,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPressed: { backgroundColor: Colors.accentPressed },
  sendDisabled: { backgroundColor: Colors.overlay },
});
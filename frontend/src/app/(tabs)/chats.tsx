import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { StateView } from '@/components/state-view';
import { Avatar } from '@/components/ui/avatar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { useRequireAuth } from '@/features/auth/use-require-auth';
import { useInbox } from '@/features/chats/use-chats';
import { formatChatTime } from '@/lib/format';
import type { ChatPreviewDto } from '@/lib/types/api';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { isGuest } = useRequireAuth();
  const { chats, threads, buys, sells } = useInbox(!isGuest);

  // Al volver de un hilo los contadores de no leídos cambiaron: se refresca al enfocar la pestaña.
  useFocusEffect(
    useCallback(() => {
      // refetch ignora `enabled`: sin sesión no hay inbox que pedir.
      if (!isGuest) void chats.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGuest]),
  );

  const renderRow = (thread: ChatPreviewDto) => (
    <Pressable
      key={thread.id}
      accessibilityRole="button"
      onPress={() => router.push(`/chat/${thread.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Avatar name={thread.counterpart.fullName} size={48} />
      <View style={styles.rowInfo}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>{thread.counterpart.fullName}</Text>
          <Text style={styles.rowTime}>{formatChatTime(thread.lastMessage?.createdAt ?? thread.updatedAt)}</Text>
        </View>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {thread.vehicle?.title ?? 'Consulta general'}
          {thread.lastMessage ? ` · ${thread.lastMessage.content}` : ''}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {thread.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{thread.unreadCount}</Text>
          </View>
        ) : null}
        <Feather name="chevron-right" size={18} color={Colors.textMuted} />
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Inbox" />
      {isGuest ? (
        <SignInPrompt
          icon="message-circle"
          title="Tus conversaciones"
          body="Iniciá sesión para escribirle a vendedores y compradores y ver tus mensajes."
          onSignIn={() => router.push('/login')}
          onRegister={() => router.push('/register')}
        />
      ) : (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={chats.isRefetching} onRefresh={() => void chats.refetch()} tintColor={Colors.textMuted} />}>
        {chats.isPending ? (
          <View style={styles.list}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={styles.row}>
                <Skeleton width={48} height={48} radius={Radius.full} />
                <View style={styles.rowInfo}>
                  <Skeleton width="50%" />
                  <Skeleton width="80%" height={12} />
                </View>
              </View>
            ))}
          </View>
        ) : chats.isError ? (
          <StateView icon="wifi-off" title="No pudimos cargar tus chats" actionLabel="Reintentar" onAction={() => void chats.refetch()} />
        ) : null}
        {buys.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Compras" />
            <View style={styles.list}>{buys.map(renderRow)}</View>
          </View>
        ) : null}
        {sells.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Ventas" />
            <View style={styles.list}>{sells.map(renderRow)}</View>
          </View>
        ) : null}
        {chats.isSuccess && threads.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="message-circle" size={44} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Sin conversaciones</Text>
            <Text style={styles.emptyBody}>Tu bandeja se llena cuando coordinás con un vendedor.</Text>
          </View>
        ) : null}
      </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.md },
  section: { gap: Spacing.lg, marginBottom: Spacing.xxl },
  list: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: Hairline,
    borderBottomColor: Colors.border,
  },
  rowPressed: { backgroundColor: Colors.overlay },
  rowInfo: { flex: 1, gap: Spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  rowTitle: { flex: 1, ...Type.bodyStrong, color: Colors.text },
  rowTime: { ...Type.caption, color: Colors.textMuted },
  rowSubtitle: { ...Type.bodySm, color: Colors.textSecondary },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { ...Type.labelSm, color: Colors.textInverse, marginTop: -1 },
  empty: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.huge },
  emptyTitle: { ...Type.h2, color: Colors.text },
  emptyBody: { ...Type.body, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xxl },
});
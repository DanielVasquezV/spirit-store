import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Avatar } from '@/components/ui/avatar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Colors, Hairline, Layout, Radius, Spacing, Type } from '@/constants/theme';
import { CHAT_THREADS, getProductById } from '@/lib/mock-data';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const buys = CHAT_THREADS.filter((thread) => thread.type === 'buy');
  const sells = CHAT_THREADS.filter((thread) => thread.type === 'sell');

  const renderRow = (threadId: string) => {
    const thread = CHAT_THREADS.find((item) => item.id === threadId);
    if (!thread) return null;
    const product = getProductById(thread.vehicleId);
    const last = thread.messages[thread.messages.length - 1];

    return (
      <Pressable
        key={thread.id}
        accessibilityRole="button"
        onPress={() => router.push(`/chat/${thread.id}`)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <Avatar name={thread.peerName} size={48} />
        <View style={styles.rowInfo}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle} numberOfLines={1}>{thread.peerName}</Text>
            <Text style={styles.rowTime}>{thread.lastTime}</Text>
          </View>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {product?.title} · {last.text}
          </Text>
        </View>
        <View style={styles.rowRight}>
          {thread.unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{thread.unread}</Text>
            </View>
          ) : null}
          <Feather name="chevron-right" size={18} color={Colors.textMuted} />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Inbox" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 104 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        {buys.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Compras" />
            <View style={styles.list}>{buys.map((thread) => renderRow(thread.id))}</View>
          </View>
        ) : null}
        {sells.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Ventas" />
            <View style={styles.list}>{sells.map((thread) => renderRow(thread.id))}</View>
          </View>
        ) : null}
        {CHAT_THREADS.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="message-circle" size={44} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Sin conversaciones</Text>
            <Text style={styles.emptyBody}>Tu bandeja se llena cuando coordinás con un vendedor.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Layout.screenX, paddingTop: Spacing.md },
  section: { gap: Spacing.lg },
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
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { listChats, listMessages, markRead, openChat, sendMessage, unreadCount } from '@/lib/api/chats';
import { useIsAuthenticated } from '@/features/auth/session-provider';
import type { Paginated } from '@/lib/api/http-client';
import { subscribe, watchChat } from '@/lib/api/socket-client';
import type { ChatMessageDto, ChatType } from '@/lib/types/api';
import { groupByRole, uniqueMessages } from './chat-rules';

const PAGE_SIZE = 30;

export const chatKeys = {
  all: ['chats'] as const,
  list: ['chats', 'list'] as const,
  unread: ['chats', 'unread'] as const,
  messages: (chatId: string) => ['chats', 'messages', chatId] as const,
};

function nextPage(last: Paginated<unknown>): number | undefined {
  return last.page < last.totalPages ? last.page + 1 : undefined;
}

export function useChatList(enabled = true) {
  const authed = useIsAuthenticated();
  return useInfiniteQuery({
    queryKey: chatKeys.list,
    queryFn: ({ pageParam }) => listChats(pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: enabled && authed,
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery({ queryKey: chatKeys.unread, queryFn: unreadCount, enabled });
}

export function useChatMessages(chatId: string | undefined) {
  const authed = useIsAuthenticated();
  return useInfiniteQuery({
    queryKey: chatKeys.messages(chatId ?? ''),
    queryFn: ({ pageParam }) => listMessages(chatId!, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: authed && Boolean(chatId),
  });
}

// Abre (o recupera) la conversación de un vehículo: el backend es idempotente por vehicleId.
export function useOpenChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, chatType }: { vehicleId: string; chatType?: ChatType }) => openChat(vehicleId, chatType),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chatKeys.list }),
  });
}

type MessagePages = InfiniteData<Paginated<ChatMessageDto>, number>;

// Los mensajes llegan por REST (el propio) y por socket (todos): se dedupe por id en la primera página.
export function prependMessage(data: MessagePages | undefined, message: ChatMessageDto): MessagePages | undefined {
  if (!data) return data;
  if (data.pages.some((page) => page.items.some((item) => item.id === message.id))) return data;
  const [first, ...rest] = data.pages;
  return { ...data, pages: [{ ...first, items: [message, ...first.items], total: first.total + 1 }, ...rest] };
}

// Hilo en vivo: sala del chat, mensajes entrantes, recibos de lectura y envío.
export function useLiveChat(chatId: string | undefined, viewerId: string | undefined) {
  const queryClient = useQueryClient();
  const messages = useChatMessages(chatId);
  const key = chatKeys.messages(chatId ?? '');

  const markAsRead = useCallback(() => {
    if (!chatId) return;
    void markRead(chatId)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: chatKeys.unread });
        void queryClient.invalidateQueries({ queryKey: chatKeys.list });
      })
      .catch(() => {});
  }, [chatId, queryClient]);

  useEffect(() => {
    if (!chatId) return;
    markAsRead();
    let cleanups: (() => void)[] = [];
    let cancelled = false;
    void Promise.all([
      watchChat(chatId),
      subscribe('chat:message', (event) => {
        if (event.chatId !== chatId) return;
        queryClient.setQueryData<MessagePages>(key, (data) => prependMessage(data, event.message));
        // Si el hilo está abierto lo que entra ya se está leyendo.
        if (event.message.senderId !== viewerId) markAsRead();
      }),
      subscribe('chat:read', (event) => {
        if (event.chatId !== chatId || event.readerId === viewerId) return;
        queryClient.setQueryData<MessagePages>(key, (data) =>
          data
            ? {
                ...data,
                pages: data.pages.map((page) => ({
                  ...page,
                  items: page.items.map((item) => (item.senderId === viewerId ? { ...item, isRead: true } : item)),
                })),
              }
            : data,
        );
      }),
    ]).then((fns) => {
      if (cancelled) fns.forEach((fn) => fn());
      else cleanups = fns;
    });
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, viewerId, queryClient, markAsRead]);

  const send = useMutation({
    mutationFn: (content: string) => sendMessage(chatId!, content),
    onSuccess: (message) => {
      queryClient.setQueryData<MessagePages>(key, (data) => prependMessage(data, message));
      void queryClient.invalidateQueries({ queryKey: chatKeys.list });
    },
  });

  // No existe GET /chats/:id: la cabecera del hilo sale del listado del inbox.
  const chats = useChatList();
  const thread = chats.data?.pages.flatMap((page) => page.items).find((item) => item.id === chatId);
  const pages = messages.data?.pages;
  const items = useMemo(() => uniqueMessages(pages?.flatMap((page) => page.items) ?? []), [pages]);

  return { messages, items, thread, send };
}

// Inbox agrupado en Compras y Ventas según el lado del usuario en cada conversación.
export function useInbox(enabled = true) {
  const chats = useChatList(enabled);
  const threads = chats.data?.pages.flatMap((page) => page.items) ?? [];
  return { chats, threads, ...groupByRole(threads) };
}

// Total de no leídos para la tab: se invalida con cada mensaje que entra por la sala personal.
export function useInboxBadge(enabled: boolean): number {
  const queryClient = useQueryClient();
  const unread = useUnreadCount(enabled);

  useEffect(() => {
    if (!enabled) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void subscribe('chat:message', () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.unread });
      void queryClient.invalidateQueries({ queryKey: chatKeys.list });
    }).then((fn) => {
      if (cancelled) fn();
      else stop = fn;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [enabled, queryClient]);

  return unread.data?.unread ?? 0;
}

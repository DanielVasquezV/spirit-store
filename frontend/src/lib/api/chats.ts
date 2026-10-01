import { http, type Paginated } from './http-client';
import type { ChatMessageDto, ChatPreviewDto, ChatType } from '@/lib/types/api';

export function listChats(page: number, pageSize: number): Promise<Paginated<ChatPreviewDto>> {
  return http.paginated<ChatPreviewDto>('/chats', { query: { page, pageSize } });
}

/** El backend devuelve 201 si la conversación es nueva y 200 si ya existía. */
export function openChat(vehicleId: string, chatType?: ChatType): Promise<ChatPreviewDto> {
  return http.post<ChatPreviewDto>('/chats', chatType ? { vehicleId, chatType } : { vehicleId });
}

export function listMessages(chatId: string, page: number, pageSize: number): Promise<Paginated<ChatMessageDto>> {
  return http.paginated<ChatMessageDto>(`/chats/${chatId}/messages`, { query: { page, pageSize } });
}

export function sendMessage(chatId: string, content: string): Promise<ChatMessageDto> {
  return http.post<ChatMessageDto>(`/chats/${chatId}/messages`, { content });
}

export function markRead(chatId: string): Promise<{ markedAsRead: number }> {
  return http.patch<{ markedAsRead: number }>(`/chats/${chatId}/read`);
}

export function unreadCount(): Promise<{ unread: number }> {
  return http.get<{ unread: number }>('/chats/unread');
}
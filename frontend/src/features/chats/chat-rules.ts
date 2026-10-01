import { CHAT_TYPE_LABELS } from '@/lib/taxonomy';
import type { ChatMessageDto, ChatPreviewDto } from '@/lib/types/api';

// Reglas puras del chat: agrupado del inbox, cabecera del hilo y deduplicado de mensajes.

export function groupByRole(threads: ChatPreviewDto[]): { buys: ChatPreviewDto[]; sells: ChatPreviewDto[] } {
  return {
    buys: threads.filter((thread) => thread.viewerRole === 'BUYER'),
    sells: threads.filter((thread) => thread.viewerRole === 'SELLER'),
  };
}

export function threadSubtitle(thread: ChatPreviewDto): string {
  return `${thread.counterpart.fullName} · ${thread.viewerRole === 'BUYER' ? CHAT_TYPE_LABELS.PURCHASE : CHAT_TYPE_LABELS.SALE}`;
}

// Una página nueva se desplaza cuando entran mensajes por socket: el id evita duplicados al paginar.
export function uniqueMessages(items: ChatMessageDto[]): ChatMessageDto[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

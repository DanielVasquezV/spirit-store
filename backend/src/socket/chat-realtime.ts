// Eventos de chat y diagnostico.
//
// Los servicios de chat y de diagnostico empujan aca sin conocer la instancia
// de Socket.IO, igual que `realtime.ts` hace con las pujas. El sink es un
// no-op cuando el socket no esta levantado, para que un test del servicio no
// tenga que montar un servidor de sockets.

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessageEvent {
  chatId: string;
  message: {
    id: string;
    chatId: string;
    senderId: string;
    senderName: string;
    content: string;
    messageType: string;
    metadata: unknown;
    isRead: boolean;
    createdAt: string;
  };
}

export interface ChatMessagesReadEvent {
  chatId: string;
  /** Quien leyo, para que el otro actualice sus ticks. */
  readerId: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Diagnostico con IA
// ---------------------------------------------------------------------------

export interface DiagnosticDoneEvent {
  /** A quien va dirigido. El socket siempre tiene unido al usuario a su sala. */
  userId: string;
  diagnosticId: string;
  summary: string | null;
  severity: string | null;
  confidence: number | null;
}

export interface RealtimeSink {
  /** Mensaje nuevo: va a la sala del chat para que lo vean los dos. */
  chatMessage: (event: ChatMessageEvent) => void;
  /** Aviso de lectura: sala del chat, para tildar los mensajes del otro. */
  chatMessagesRead: (event: ChatMessagesReadEvent) => void;
  /** Cierre del diagnostico, con el veredicto ya persistido. */
  diagnosticDone: (event: DiagnosticDoneEvent) => void;
}

const noop: RealtimeSink = {
  chatMessage: () => undefined,
  chatMessagesRead: () => undefined,
  diagnosticDone: () => undefined,
};

let sink: RealtimeSink = noop;

export function setRealtimeSink(next: RealtimeSink | null): void {
  sink = next ?? noop;
}

export function emitChatMessage(event: ChatMessageEvent): void {
  sink.chatMessage(event);
}

export function emitChatMessagesRead(event: ChatMessagesReadEvent): void {
  sink.chatMessagesRead(event);
}

export function emitDiagnosticDone(event: DiagnosticDoneEvent): void {
  sink.diagnosticDone(event);
}
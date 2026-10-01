import { env } from '../../config/env.js';

// Cliente /chat/completions compatible con OpenAI: Groq por defecto; DeepSeek u OpenRouter cambiando AI_BASE_URL y AI_MODEL.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatJsonArgs {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export class AiError extends Error {
  // true si reintentar más tarde tiene sentido (cuota, caída del proveedor, timeout).
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'AiError';
    this.retryable = retryable;
  }
}

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

export function aiAvailable(): boolean {
  return Boolean(env.ai.apiKey);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Los modelos de razonamiento a veces envuelven el JSON en ```json o agregan texto antes: se rescata el objeto.
export function parseLooseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) throw new AiError('El modelo no devolvió JSON', true);
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      throw new AiError('El modelo devolvió JSON inválido', true);
    }
  }
}

interface CompletionResponse {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  error?: { message?: string };
}

async function callOnce(args: ChatJsonArgs): Promise<{ text: string; model: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${env.ai.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.ai.model,
        messages: args.messages,
        temperature: args.temperature ?? 0.3,
        max_tokens: args.maxTokens ?? 1500,
        response_format: { type: 'json_object' },
        // gpt-oss razona antes de responder: con esfuerzo bajo la respuesta llega en 1-2 s en Groq.
        ...(env.ai.model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as CompletionResponse;
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      const error = new AiError(payload.error?.message ?? `El proveedor respondió ${response.status}`, retryable);
      (error as AiError & { retryAfterMs?: number }).retryAfterMs = Number(response.headers.get('retry-after')) * 1000 || undefined;
      throw error;
    }
    const text = payload.choices?.[0]?.message?.content ?? '';
    if (!text) throw new AiError('El modelo devolvió una respuesta vacía', true);
    return { text, model: payload.model ?? env.ai.model };
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError(controller.signal.aborted ? 'El modelo tardó demasiado en responder' : (err as Error).message, true);
  } finally {
    clearTimeout(timer);
  }
}

// Pide una respuesta en JSON y la parsea; reintenta con backoff cuando el fallo es transitorio.
export async function chatJson<T>(args: ChatJsonArgs): Promise<{ data: T; model: string }> {
  if (!aiAvailable()) throw new AiError('Falta configurar GROQ_API_KEY', false);
  let lastError: AiError = new AiError('Sin respuesta del modelo', true);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { text, model } = await callOnce(args);
      return { data: parseLooseJson(text) as T, model };
    } catch (err) {
      lastError = err as AiError;
      if (!lastError.retryable || attempt === MAX_ATTEMPTS) break;
      const hinted = (lastError as AiError & { retryAfterMs?: number }).retryAfterMs;
      // El tope de 4 s evita que un retry-after largo deje colgado el request del usuario.
      await sleep(Math.min(hinted ?? 600 * 2 ** (attempt - 1), 4000));
    }
  }
  throw lastError;
}

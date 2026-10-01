import { env } from '../../config/env.js';

// Cliente de Gemini por HTTP, contra la API generativelanguage.
//
// Se llama por `fetch` y no con el SDK oficial a proposito: el SDK agrega una
// dependencia (y sus peers) por una sola llamada HTTP que ya cabe en un
// request. La API es estable y el payload es pequeno.

// `generateContent` acepta el modelo en la URL y la key en el header, asi que
// la key nunca viaja en un query string (donde acabaria en logs de proxy).
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiPart {
  text: string;
}

export interface GeminiUsage {
  promptTokens: number | null;
  candidatesTokens: number | null;
  totalTokens: number | null;
}

export interface GeminiResult {
  text: string;
  model: string;
  usage: GeminiUsage;
  /** Fin de la respuesta normalizada para que el llamador la pueda parsear. */
  finishReason: string | null;
}

/**
 * Reintenta solo lo transitorio (429 y 5xx) y solo si queda tiempo.
 *
 * Un 503 de "high demand" es la razon de existir de este retry: la API de Gemini
 * satura de forma intermitente y una sola llamada pierde el diagnostico entero
 * aunque la key y el prompt esten bien. Un 404 de modelo inexistente o un 400 de
 * prompt invalido no se reintentan: reintentar solo gasta cuota y tarda mas en
 * devolver el error real.
 *
 * El backoff suma jitter porque si varios clientes repiten a la vez el mismo
 * milisegundo vuelven a caer en el mismo pico.
 */
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Un intento de `fetch` + parseo, sin reintentos ni manejo de errores. */
async function callOnce(config: GeminiConfig, args: GenerateArgs, signal: AbortSignal): Promise<GeminiResult> {
  const response = await fetch(`${BASE_URL}/models/${config.model}:generateContent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': config.apiKey,
    },
    signal,
    body: JSON.stringify({
      systemInstruction: args.systemInstruction ? { parts: [{ text: args.systemInstruction }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: buildContents(args) }] }],
      generationConfig: {
        temperature: args.temperature ?? 0.3,
        maxOutputTokens: args.maxOutputTokens ?? 1024,
        ...(args.responseSchema ? { responseMimeType: 'application/json', responseSchema: args.responseSchema } : {}),
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    // 429 y 5xx son transitorios: la app puede reintentar. 400 es un prompt
    // malo y reintentar solo gastaria cuota.
    const retryable = response.status === 429 || response.status >= 500;
    throw new GeminiError(
      `Gemini respondio ${response.status}: ${body.slice(0, 300) || response.statusText}`,
      response.status,
      retryable,
    );
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };

  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? '';

  if (!text) {
    throw new GeminiError('Gemini devolvio una respuesta vacia', null, true);
  }

  return {
    text,
    model: config.model,
    finishReason: candidate?.finishReason ?? null,
    usage: {
      promptTokens: payload.usageMetadata?.promptTokenCount ?? null,
      candidatesTokens: payload.usageMetadata?.candidatesTokenCount ?? null,
      totalTokens: payload.usageMetadata?.totalTokenCount ?? null,
    },
  };
}

/** Genera una respuesta de texto, reintentando lo transitorio. */
export async function generateText(args: GenerateArgs): Promise<GeminiResult> {
  const config = requireConfig();

  // Un unico reloj para toda la cadena de intentos: los reintentos comparten el
  // presupuesto de tiempo con el primer intento, para que un proveedor lento no
  // pueda dejar la peticion colgada el triple de lo permitido.
  const controller = new AbortController();
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let lastError: GeminiError | null = null;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await callOnce(config, args, controller.signal);
      } catch (err) {
        const asGemini = err instanceof GeminiError ? err : toGeminiError(err);
        lastError = asGemini;

        const quedanIntentos = attempt < MAX_ATTEMPTS;
        const quedaTiempo = deadline - Date.now() > BASE_BACKOFF_MS;
        if (!asGemini.retryable || !quedanIntentos || !quedaTiempo) throw asGemini;

        const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1);
        await sleep(backoff + Math.floor(Math.random() * 250));
      }
    }

    // Solo se llega aca si el bucle agoto los intentos sin excepcion, que no
    // deberia pasar: `lastError` siempre esta seteado para ese caso.
    throw lastError ?? new GeminiError('Gemini no respondio', null, true);
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    // Abort: el modelo tardo mas de lo que el cliente va a esperar.
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new GeminiError(`Gemini no respondio en ${REQUEST_TIMEOUT_MS / 1000}s`, null, true);
    }
    throw toGeminiError(err);
  } finally {
    clearTimeout(timer);
  }
}

function toGeminiError(err: unknown): GeminiError {
  return new GeminiError(`No se pudo llamar a Gemini: ${(err as Error).message}`, null, true);
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/** Corta la generacion: una respuesta de diagnostico que tarda 60s no la va a
 *  esperar nadie, y el socket queda colgado mientras tanto. Es el presupuesto
 *  total, intentos incluidos, no por intento. */
const REQUEST_TIMEOUT_MS = 30_000;

function isConfigured(): boolean {
  return Boolean(env.gemini.apiKey);
}

/**
 * `responseMimeType: application/json` con un `responseSchema` es lo que hace
 * que el modelo devuelva JSON parseable en vez de prosa con un `{}` en medio.
 *
 * El schema va entero y repetido donde haga falta: la API de Gemini no soporta
 * `$ref` dentro de `responseSchema`, asi que un schema referenciado desde varios
 * lados se devuelve incompleto y el modelo responde en prosa.
 */
export interface GeminiJsonSchema {
  type: string;
  properties?: Record<string, GeminiJsonSchema>;
  items?: GeminiJsonSchema;
  enum?: string[];
  required?: string[];
  nullable?: boolean;
  description?: string;
}

interface GeminiConfig {
  apiKey: string;
  model: string;
}

function requireConfig(): GeminiConfig {
  const apiKey = env.gemini.apiKey;
  if (!apiKey) {
    throw new GeminiError(
      'GEMINI_API_KEY no esta configurada: el diagnostico con IA no esta disponible',
      null,
      false,
    );
  }
  return { apiKey, model: env.gemini.model };
}

interface GenerateArgs {
  /** Instrucciones de sistema: rol, tono y reglas duras. */
  systemInstruction?: string;
  /** El turno del usuario. */
  prompt: string;
  /** Contexto estructurado (ficha del vehiculo, historial). Va en el prompt. */
  context?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Obliga a devolver JSON con esta forma. */
  responseSchema?: GeminiJsonSchema;
}

/** `systemInstruction` + `context` + `prompt` en un solo string de entrada. */
function buildContents({ systemInstruction, prompt, context }: GenerateArgs): string {
  const parts: string[] = [];
  if (systemInstruction) parts.push(systemInstruction.trim());
  if (context) parts.push(`CONTEXTO:\n${context.trim()}`);
  parts.push(prompt.trim());
  return parts.join('\n\n');
}

/** El JSON llego bien formado pero no sirve. Se valida contra el schema pedido
 *  en vez de solo `JSON.parse`: un `{}` parsea sin problema y `normalize` lo
 *  convierte en un diagnostico con valores inventados, que es el peor resultado
 *  posible. */
function isUsableResult(parsed: unknown, schema: GeminiJsonSchema | undefined): boolean {
  if (!schema || typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;

  const required = schema.required ?? [];
  const properties = schema.properties ?? {};
  const object = parsed as Record<string, unknown>;

  for (const key of required) {
    const value = object[key];
    if (value === undefined || value === null) return false;
    // Un array vacio se acepta a proposito: la API no soporta `minItems` y el
    // llamador lo normaliza a una lista vacia en vez de a un error.
    if (typeof value === 'string' && !value.trim()) return false;
  }

  // Si el schema declara `enum`, un valor fuera de la lista es tan inutil como
  // uno ausente, y `normalize` lo cairia a MEDIUM sin avisar.
  for (const [key, prop] of Object.entries(properties)) {
    const value = object[key];
    if (prop.enum && typeof value === 'string' && !prop.enum.includes(value)) return false;
  }

  return true;
}

/**
 * Genera texto y lo parsea como JSON.
 *
 * Un modelo con `responseSchema` casi siempre devuelve JSON limpio, pero "casi
 * siempre" no es una garantia: si viene un fence ```` ```json ```` o una
 * prologalia, se recorta antes de parsear en vez de devolver un error al
 * usuario por un detalle de formato.
 *
 * Una respuesta truncada o incompleta se reintenta con el mismo presupuesto que
 * los errores transitorios y no se reporta como error de formato: cuando el
 * modelo se corta a mitad de camino un reintento suele resolverlo, y sin esto un
 * `maxOutputTokens` ajustado se traduce siempre en un fallo para el usuario.
 */
export async function generateJson<T>(args: GenerateArgs): Promise<{ data: T; result: GeminiResult }> {
  const config = requireConfig();

  const controller = new AbortController();
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let lastError: GeminiError | null = null;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await callOnce(config, args, controller.signal);
        const parsed = parseLooseJson(result.text);

        if (parsed !== undefined && isUsableResult(parsed, args.responseSchema)) {
          return { data: parsed as T, result };
        }

        lastError = new GeminiError(
          result.finishReason === 'MAX_TOKENS'
            ? 'Gemini se quedo sin tokens para completar el JSON'
            : 'Gemini devolvio una respuesta incompleta o no parseable',
          null,
          true,
        );
      } catch (err) {
        lastError = err instanceof GeminiError ? err : toGeminiError(err);
      }

      const quedanIntentos = attempt < MAX_ATTEMPTS;
      // El backoff tiene que caber en el presupuesto que queda: si no, se
      // devuelve el error ahora en vez de gastar el resto del tiempo
      // esperando un reintento que ya no va a entrar.
      const quedaTiempo = deadline - Date.now() > BASE_BACKOFF_MS;
      if (!lastError.retryable || !quedanIntentos || !quedaTiempo) throw lastError;

      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
    }

    throw lastError ?? new GeminiError('Gemini no devolvio un resultado usable', null, true);
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new GeminiError(`Gemini no respondio en ${REQUEST_TIMEOUT_MS / 1000}s`, null, true);
    }
    throw toGeminiError(err);
  } finally {
    clearTimeout(timer);
  }
}

export function parseLooseJson(text: string): unknown {
  const trimmed = text.trim();

  // Sin fence es JSON directo.
  try {
    return JSON.parse(trimmed);
  } catch {
    // sigue
  }

  // Con fence: ```json ... ``` o ``` ... ```
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // sigue
    }
  }

  // Con prologo o epilogo: se recorta al primer `{` o `[` y al ultimo cierre.
  const start = trimmed.search(/[{[]/);
  if (start === -1) return undefined;
  const closer = trimmed[start] === '{' ? '}' : ']';
  const end = trimmed.lastIndexOf(closer);
  if (end <= start) return undefined;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

export const geminiAvailable = isConfigured;
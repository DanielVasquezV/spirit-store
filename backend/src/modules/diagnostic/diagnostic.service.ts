import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { generateJson, GeminiError, geminiAvailable } from './gemini.client.js';
import { emitDiagnosticDone } from '../../socket/chat-realtime.js';
import type { GeminiJsonSchema } from './gemini.client.js';
import type { DiagnosticSeverity, Prisma } from '../../generated/prisma/client.js';

// Asistente de diagnostico vehicular con Gemini.
//
// El modelo es una ayuda, no un perito: devuelve una lista de causas probables
// con su veredicto de severidad, y el texto siempre dice que es orientativo.
// Nunca se presenta como diagnostico definitivo.

// El schema del modelo. Sin esto Gemini devuelve prosa y hay que parsear a
// mano; con el, el JSON sale con la forma pedida.
const DIAGNOSTIC_SCHEMA: GeminiJsonSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Diagnostico en 2 a 4 frases, en espanol rioplatense, dirigido a un dueño no tecnico.',
    },
    severity: {
      type: 'string',
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      description:
        'LOW no urgente, MEDIUM conviene revisarlo pronto, HIGH revisar antes de seguir usandolo, CRITICAL no usarlo y revisar ya.',
    },
    confidence: {
      type: 'number',
      description: 'Confianza entre 0 y 1. Si el modelo no puede afirmarlo con seguridad, un numero bajo.',
    },
    likelyCauses: {
      type: 'array',
      description: 'Causas mas probables, de mas a menos probable. Entre 2 y 4.',
      items: {
        type: 'object',
        properties: {
          cause: { type: 'string', description: 'La causa, en una frase.' },
          likelihood: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          whyItFits: { type: 'string', description: 'Por que encaja con los sintomas descritos.' },
        },
        required: ['cause', 'likelihood', 'whyItFits'],
      },
    },
    checks: {
      type: 'array',
      description: 'Verificaciones simples que el dueño puede hacer sin taller.',
      items: { type: 'string' },
    },
    recommendedNextSteps: {
      type: 'array',
      description: 'Que hacer ahora, en orden. Entre 1 y 4 pasos.',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'severity', 'confidence', 'likelyCauses', 'checks', 'recommendedNextSteps'],
};

const SYSTEM_INSTRUCTION = [
  'Sos un mecanico argentino con muchos años diagnosing fallas de vehiculos.',
  'Respondés en español rioplatense, con voseo, sin jerga innecesaria: el lector es',
  'el dueño del auto, no un técnico.',
  '',
  'Reglas que no se negocian:',
  '- Sos una ayuda, no un perito. NUNCA inventes una pieza, un codigo de falla o un precio.',
  '- Si la falla es de seguridad (frenos, direccion, frenos de emergencia) o puede dejar al',
  '  vehiculo tirado en la ruta, decilo de forma explicita y marcá la severidad CRITICAL.',
  '- Si te falta informacion para afirmarlo, decilo y pedi los datos que faltan en',
  '  recommendedNextSteps en vez de adivinar.',
  '- No recomiendes continuar usando el vehiculo si la severidad es HIGH o CRITICAL.',
].join('\n');

/**
 * Corta antes de gastar una llamada si no hay key.
 *
 * Sin `GEMINI_API_KEY` el diagnostico no se puede hacer: no hay modelo al que
 * preguntarle. Se responde 503 y no un error generico para que el cliente lo
 * distinga de una caida real del proveedor.
 */
export function assertAiAvailable(): void {
  if (!geminiAvailable()) {
    throw new AppError(
      503,
      'AI_UNAVAILABLE',
      'El diagnostico con IA no esta disponible: falta configurar GEMINI_API_KEY',
    );
  }
}

/** Configura el contexto del vehiculo como texto para el prompt. */
export function buildVehicleContext(input: {
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
  engine?: string | null;
  transmission?: string | null;
  fuel?: string | null;
}): string | undefined {
  const lines: string[] = [];
  if (input.brand && input.model) lines.push(`Vehiculo: ${input.brand} ${input.model}`);
  if (input.year) lines.push(`Anio: ${input.year}`);
  if (input.mileage) lines.push(`Kilometraje: ${input.mileage.toLocaleString('es-AR')} km`);
  if (input.engine) lines.push(`Motor: ${input.engine}`);
  if (input.transmission) lines.push(`Cambio: ${input.transmission}`);
  if (input.fuel) lines.push(`Combustible: ${input.fuel}`);
  return lines.length > 0 ? lines.join('\n') : undefined;
}

export interface DiagnosisPayload {
  summary: string;
  severity: DiagnosticSeverity;
  confidence: number;
  likelyCauses: { cause: string; likelihood: 'LOW' | 'MEDIUM' | 'HIGH'; whyItFits: string }[];
  checks: string[];
  recommendedNextSteps: string[];
}

const SEVERITIES: DiagnosticSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const LIKELIHOODS = ['LOW', 'MEDIUM', 'HIGH'] as const;

/**
 * Valida y normaliza lo que devuelve el modelo.
 *
 * No se confia en el JSON del modelo: un `severity: "MUY MAL"` o un
 * `confidence: 12` tienen que terminar en la base como un enum y un 0..1, no
 * como lo que el modelo escribio.
 */
function normalize(raw: unknown): DiagnosisPayload {
  const o = (raw ?? {}) as Record<string, unknown>;

  const rawSeverity = String(o.severity ?? '').toUpperCase();
  const severity: DiagnosticSeverity = SEVERITIES.includes(rawSeverity as DiagnosticSeverity)
    ? (rawSeverity as DiagnosticSeverity)
    : 'MEDIUM';

  const rawConfidence = Number(o.confidence);
  const confidence = Number.isFinite(rawConfidence) ? Math.min(1, Math.max(0, rawConfidence)) : 0.5;

  const asStringArray = (value: unknown, max: number): string[] =>
    Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean).slice(0, max)
      : [];

  const rawCauses = Array.isArray(o.likelyCauses) ? o.likelyCauses : [];
  const likelyCauses = rawCauses
    .slice(0, 4)
    .map((entry) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      const likelihoodRaw = String(e.likelihood ?? '').toUpperCase();
      return {
        cause: typeof e.cause === 'string' && e.cause.trim() ? e.cause.trim() : 'Causa no especificada',
        likelihood: LIKELIHOODS.includes(likelihoodRaw as (typeof LIKELIHOODS)[number])
          ? (likelihoodRaw as 'LOW' | 'MEDIUM' | 'HIGH')
          : 'MEDIUM',
        whyItFits: typeof e.whyItFits === 'string' ? e.whyItFits.trim() : '',
      };
    })
    .filter((c) => c.cause.length > 0);

  const summary = typeof o.summary === 'string' && o.summary.trim()
    ? o.summary.trim()
    : 'El modelo no devolvio un resumen para esta falla.';

  return {
    summary,
    severity,
    confidence,
    likelyCauses,
    checks: asStringArray(o.checks, 6),
    recommendedNextSteps: asStringArray(o.recommendedNextSteps, 5),
  };
}

export interface AiDiagnosticDto {
  id: string;
  vehicleId: string | null;
  title: string;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  mileage: number | null;
  symptoms: unknown;
  summary: string | null;
  confidence: number | null;
  severity: DiagnosticSeverity | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

const DIAGNOSTIC_INCLUDE = {
  messages: {
    orderBy: { createdAt: 'asc' },
    include: {},
  },
} as const satisfies Prisma.AiDiagnosticInclude;

type DiagnosticRow = Prisma.AiDiagnosticGetPayload<{ include: typeof DIAGNOSTIC_INCLUDE }>;

export interface DiagnosticMessageDto {
  id: string;
  sender: 'USER' | 'AI_ASSISTANT';
  content: string;
  model: string | null;
  createdAt: string;
}

export interface AiDiagnosticDetailDto extends AiDiagnosticDto {
  messages: DiagnosticMessageDto[];
}

/** Los campos de la fila, sin el hilo. Base del detalle y de los listados. */
function toDiagnosticFields(row: Omit<DiagnosticRow, 'messages'>): AiDiagnosticDto {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    title: row.title,
    vehicleBrand: row.vehicleBrand,
    vehicleModel: row.vehicleModel,
    vehicleYear: row.vehicleYear,
    mileage: row.mileage,
    symptoms: row.symptoms ?? null,
    summary: row.summary,
    confidence: row.confidence,
    severity: row.severity,
    resolved: row.resolved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDiagnosticDto(row: DiagnosticRow): AiDiagnosticDetailDto {
  return {
    ...toDiagnosticFields(row),
    messages: row.messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      content: m.content,
      model: m.model,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export interface CreateDiagnosticInput {
  title: string;
  vehicleId?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  mileage?: number;
  symptoms?: unknown;
}

const MAX_TITLE_LENGTH = 120;

export function diagnosticsAvailable(): boolean {
  return geminiAvailable();
}

/** `AppError` con el codigo de error de la API, para 503 sin key. */

/**
 * Crea un diagnostico y pide el primer analisis a Gemini.
 *
 * La fila se crea ANTES de llamar al modelo a proposito: si la llamada falla
 * (sin quota, key invalida, timeout) el usuario conserva la pregunta y puede
 * reintentar sin volver a escribirla, en vez de perderla. Por eso `summary`
 * arranca en null y no se descarta la fila ante un error del proveedor.
 */
export async function createDiagnostic(
  userId: string,
  input: CreateDiagnosticInput,
): Promise<AiDiagnosticDetailDto> {
  const title = input.title.trim();
  if (!title) {
    throw AppError.badRequest('Validation failed', { title: 'title no puede estar vacio' });
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw AppError.badRequest('Validation failed', {
      title: `title admite hasta ${MAX_TITLE_LENGTH} caracteres`,
    });
  }

  let vehicleSnapshot: {
    brand: string;
    model: string;
    year: number;
    mileage: number;
    engine: string | null;
    transmission: string | null;
    fuel: string | null;
  } | null = null;

  // Si viene de la ficha de un vehiculo, sus datos son mejores que los que el
  // usuario pueda haber tipeado a mano.
  if (input.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: input.vehicleId, deletedAt: null },
      select: { id: true, brand: true, model: true, year: true, mileage: true, engine: true, transmission: true, fuel: true },
    });
    if (!vehicle) throw AppError.notFound('Vehicle');
    vehicleSnapshot = vehicle;
  }

  // La disponibilidad se comprueba **despues** de validar la entrada y no antes:
  // un `vehicleId` inexistente tiene que dar 404 haya o no key, si no el mismo
  // request devuelve un codigo distinto segun como este configurado el servidor.
  //
  // Y se comprueba antes de crear la fila: sin key no hay nada que analizar, asi
  // que la fila seria un diagnostico vacio que el usuario nunca pidio y que queda
  // en su lista para siempre.
  assertAiAvailable();

  const diagnostic = await prisma.aiDiagnostic.create({
    data: {
      userId,
      vehicleId: input.vehicleId ?? null,
      vehicleBrand: vehicleSnapshot?.brand ?? input.vehicleBrand ?? null,
      vehicleModel: vehicleSnapshot?.model ?? input.vehicleModel ?? null,
      vehicleYear: vehicleSnapshot?.year ?? input.vehicleYear ?? null,
      mileage: vehicleSnapshot?.mileage ?? input.mileage ?? null,
      title,
      symptoms: input.symptoms === undefined ? undefined : (input.symptoms as Prisma.InputJsonValue),
    },
    include: DIAGNOSTIC_INCLUDE,
  });

  // El turno del usuario queda guardado como mensaje, igual que la respuesta:
  // el hilo completo es lo que se le reinyecta al modelo en la pregunta de
  // seguimiento.
  await prisma.aiDiagnosticMessage.create({
    data: { diagnosticId: diagnostic.id, sender: 'USER', content: title },
  });

  // Si el proveedor falla despues de guardar la fila, el error lleva el id del
  // diagnostico en `details`. Sin eso la garantia de "no se pierde la pregunta"
  // seria falsa: el usuario tendria una fila en la base que el cliente no puede
  // ni encontrar ni reintentar.
  try {
    await runDiagnosis(diagnostic.id);
  } catch (err) {
    throw withDiagnosticId(err, diagnostic.id);
  }

  // Se relee con el `include` para devolver el hilo ya completo. Reusar la fila
  // de arriba obligaria a tipar a mano la union de la fila recien creada con la
  // respuesta del modelo, y ahi es justamente donde un campo se puede colar mal.
  const fresh = await prisma.aiDiagnostic.findUniqueOrThrow({
    where: { id: diagnostic.id },
    include: DIAGNOSTIC_INCLUDE,
  });
  return toDiagnosticDto(fresh);
}

/** Le engancha el id del diagnostico al error del proveedor, para que el cliente lo recupere. */
function withDiagnosticId(err: unknown, diagnosticId: string): AppError {
  if (err instanceof AppError) {
    return new AppError(err.statusCode, err.code, err.message, { diagnosticId });
  }
  throw err;
}

/** Convierte un error del proveedor en algo que el usuario pueda actuar. */
function toAppError(err: unknown): AppError {
  if (err instanceof GeminiError) {
    if (err.retryable) {
      return new AppError(503, 'AI_UNAVAILABLE', `El asistente no respondio: ${err.message}`);
    }
    return new AppError(502, 'AI_ERROR', `El asistente fallo: ${err.message}`);
  }
  throw err;
}

/**
 * Le pide el analisis a Gemini y lo persiste junto con la respuesta.
 *
 * Reutiliza los mensajes previos del hilo como contexto para que un seguimiento
 * ("y si es la correa?") tenga sentido sin repetir la pregunta original.
 */
export async function runDiagnosis(diagnosticId: string): Promise<Partial<AiDiagnosticDto>> {
  const diagnostic = await prisma.aiDiagnostic.findUniqueOrThrow({
    where: { id: diagnosticId },
    select: {
      id: true, userId: true, title: true, vehicleBrand: true, vehicleModel: true, vehicleYear: true,
      mileage: true, symptoms: true,
      messages: { orderBy: { createdAt: 'asc' }, select: { sender: true, content: true } },
    },
  });

  const context = buildVehicleContext({
    brand: diagnostic.vehicleBrand,
    model: diagnostic.vehicleModel,
    year: diagnostic.vehicleYear,
    mileage: diagnostic.mileage,
  });

  // Historial como texto, sin incluir el ultimo turno del usuario (ese va como
  // `prompt`: mandarlo dos veces hace que el modelo se/conteste a si mismo).
  const history = diagnostic.messages
    .slice(0, -1)
    .map((m) => (m.sender === 'USER' ? `Usuario: ${m.content}` : `Asistente: ${m.content}`))
    .join('\n');

  let data: DiagnosisPayload;
  let model: string;

  try {
    const response = await generateJson<DiagnosisPayload>({
      systemInstruction: SYSTEM_INSTRUCTION,
      context,
      prompt: diagnostic.title,
      responseSchema: DIAGNOSTIC_SCHEMA,
      temperature: 0.3,
      // El veredicto completo con las 3 listas es de ~900 a 1100 tokens. Con
      // 1400 el modelo se cortaba a mitad de camino con frecuencia y devolvia
      // JSON truncado, que es un 503 para el usuario aunque la llamada haya
      // funcionado. 2048 deja margen sin pedir mas de lo necesario.
      maxOutputTokens: 2048,
    });
    data = normalize(response.data);
    model = response.result.model;
  } catch (err) {
    throw toAppError(err);
  }

  const rendered = renderDiagnosis(data);

  const [, message] = await prisma.$transaction([
    prisma.aiDiagnostic.update({
      where: { id: diagnosticId },
      data: {
        summary: data.summary,
        severity: data.severity,
        confidence: data.confidence,
      },
    }),
    prisma.aiDiagnosticMessage.create({
      data: {
        diagnosticId,
        sender: 'AI_ASSISTANT',
        content: rendered,
        model,
        promptSnapshot: history || diagnostic.title,
      },
    }),
  ]);

  // Despues del commit: emitir adentro le mostraria al usuario un veredicto que
  // todavia puede fallar y no guardarse.
  emitDiagnosticDone({
    userId: diagnostic.userId,
    diagnosticId,
    summary: data.summary,
    severity: data.severity,
    confidence: data.confidence,
  });

  return {
    summary: data.summary,
    severity: data.severity,
    confidence: data.confidence,
    updatedAt: message.createdAt.toISOString(),
  };
}

/** El texto que se guarda y se muestra: el JSON del modelo, legible. */
function renderDiagnosis(d: DiagnosisPayload): string {
  const lines: string[] = [d.summary, '', `Severidad: ${d.severity}`];

  if (d.likelyCauses.length > 0) {
    lines.push('', 'Causas probables:');
    for (const c of d.likelyCauses) lines.push(`- ${c.cause} (${c.likelihood})${c.whyItFits ? `: ${c.whyItFits}` : ''}`);
  }
  if (d.checks.length > 0) {
    lines.push('', 'Podés revisar:');
    for (const c of d.checks) lines.push(`- ${c}`);
  }
  if (d.recommendedNextSteps.length > 0) {
    lines.push('', 'Qué hacer:');
    for (const s of d.recommendedNextSteps) lines.push(`- ${s}`);
  }
  lines.push('', 'Esto es orientativo y no reemplaza una inspección en un taller.');
  return lines.join('\n');
}

export async function listDiagnostics(
  userId: string,
  page: { skip: number; take: number },
): Promise<{ rows: AiDiagnosticDto[]; total: number }> {
  // El listado no trae el hilo: es el detalle de `GET /:id`. Incluirlo seria
  // traer toda la conversacion de cada fila para no mostrarla, y el DTO de la
  // lista ni siquiera tiene la propiedad `messages`.
  const [total, rows] = await prisma.$transaction([
    prisma.aiDiagnostic.count({ where: { userId } }),
    prisma.aiDiagnostic.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: page.skip,
      take: page.take,
    }),
  ]);

  return {
    rows: rows.map(toDiagnosticFields),
    total,
  };
}

export async function getDiagnostic(userId: string, diagnosticId: string): Promise<AiDiagnosticDetailDto> {
  const diagnostic = await prisma.aiDiagnostic.findFirst({
    where: { id: diagnosticId, userId },
    include: DIAGNOSTIC_INCLUDE,
  });
  if (!diagnostic) throw AppError.notFound('Diagnostic');
  return toDiagnosticDto(diagnostic);
}

/** Un diagnostico pertenece a su autor: `findFirst` con `userId`, no con id. */
export async function markResolved(userId: string, diagnosticId: string, resolved: boolean): Promise<AiDiagnosticDto> {
  const row = await prisma.aiDiagnostic.findFirst({ where: { id: diagnosticId, userId }, select: { id: true } });
  if (!row) throw AppError.notFound('Diagnostic');

  const updated = await prisma.aiDiagnostic.update({
    where: { id: diagnosticId },
    data: { resolved },
  });
  return toDiagnosticFields(updated);
}

/**
 * Pregunta de seguimiento sobre un diagnostico ya creado.
 *
 * La columna `title` es la pregunta original y no se toca: el diagnostico se
 * identifica por la falla que el usuario quiere resolver, no por su ultimo
 * mensaje.
 */
export async function askFollowUp(userId: string, diagnosticId: string, question: string): Promise<string> {
  const diagnostic = await prisma.aiDiagnostic.findFirst({
    where: { id: diagnosticId, userId },
    select: { id: true, title: true },
  });
  if (!diagnostic) throw AppError.notFound('Diagnostic');

  const questionTrimmed = question.trim();
  if (!questionTrimmed) {
    throw AppError.badRequest('Validation failed', { question: 'question no puede estar vacia' });
  }

  // Igual que en `createDiagnostic`: sin key no se guarda la pregunta, para no
  // dejar en el hilo un turno del usuario que nunca va a tener respuesta.
  assertAiAvailable();

  await prisma.aiDiagnosticMessage.create({
    data: { diagnosticId, sender: 'USER', content: questionTrimmed },
  });

  const result = await runDiagnosis(diagnostic.id);

  const last = await prisma.aiDiagnosticMessage.findFirst({
    where: { diagnosticId: diagnostic.id, sender: 'AI_ASSISTANT' },
    orderBy: { createdAt: 'desc' },
  });

  return last?.content ?? result.summary ?? '';
}
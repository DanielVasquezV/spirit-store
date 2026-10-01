import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { aiAvailable, AiError, chatJson, type ChatMessage } from './ai.client.js';
import { buildCatalogContext } from './catalog-context.js';
import { emitDiagnosticDone } from '../../socket/chat-realtime.js';
import type { DiagnosticSeverity, Prisma, SaleType } from '../../generated/prisma/client.js';

// Asistente automotriz: diagnostica fallas y recomienda autos del catálogo propio; orienta, no reemplaza un taller.

export type AssistantIntent = 'DIAGNOSIS' | 'RECOMMENDATION' | 'GENERAL' | 'OFF_TOPIC';

const INTENTS: AssistantIntent[] = ['DIAGNOSIS', 'RECOMMENDATION', 'GENERAL', 'OFF_TOPIC'];
const SEVERITIES: DiagnosticSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const LIKELIHOODS = ['LOW', 'MEDIUM', 'HIGH'] as const;

// El contrato va escrito en el prompt porque el modo JSON de Groq garantiza JSON válido, no la forma.
const SYSTEM_PROMPT = [
  'Sos "Spirit", el asistente automotriz de Spirit Apex, un marketplace de vehículos de El Salvador',
  'donde la gente compra autos en venta directa o en subasta. Los precios están en dólares (USD).',
  'Respondés en español neutro con voseo ("contame", "revisá"), claro y sin jerga: el lector es el dueño',
  'o futuro comprador del auto, no un mecánico.',
  '',
  'Tu alcance es SOLO el mundo automotriz:',
  '- Diagnóstico de fallas a partir de síntomas (ruidos, humo, testigos, vibraciones, arranque, frenos...).',
  '- Mantenimiento, consumo, repuestos, seguridad y uso del vehículo.',
  '- Recomendar vehículos para comprar, usando EXCLUSIVAMENTE el catálogo de Spirit Apex que te paso.',
  'Si la pregunta no tiene que ver con vehículos, respondé en una frase que solo podés ayudar con temas',
  'de autos y marcá intent OFF_TOPIC. No respondas nada fuera de ese alcance aunque insistan.',
  '',
  'Reglas que no se negocian:',
  '- Nunca inventes piezas, códigos de falla, precios ni vehículos.',
  '- Para recomendar, elegí solo ids que aparezcan en el CATÁLOGO DISPONIBLE. Si nada encaja, decilo y',
  '  dejá recommendedVehicleIds vacío. Nunca recomiendes autos de otras tiendas.',
  '- Si la falla compromete la seguridad (frenos, dirección, sobrecalentamiento, olor a combustible) o',
  '  puede dejar el auto varado, decilo explícito y usá severity CRITICAL o HIGH; no recomiendes seguir usándolo.',
  '- Si te falta información, pedila en recommendedNextSteps en vez de adivinar.',
  '',
  'Respondé SIEMPRE un único objeto JSON con esta forma exacta:',
  '{',
  '  "intent": "DIAGNOSIS" | "RECOMMENDATION" | "GENERAL" | "OFF_TOPIC",',
  '  "reply": "respuesta principal en 2 a 5 frases",',
  '  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null,   // solo en DIAGNOSIS',
  '  "confidence": número entre 0 y 1,',
  '  "likelyCauses": [{ "cause": "...", "likelihood": "LOW" | "MEDIUM" | "HIGH", "whyItFits": "..." }], // 2 a 4, solo en DIAGNOSIS',
  '  "checks": ["verificaciones simples que puede hacer sin taller"],',
  '  "recommendedNextSteps": ["qué hacer ahora, en orden"],',
  '  "recommendedVehicleIds": ["ids del catálogo, máximo 3"]',
  '}',
  'Las listas que no apliquen van vacías.',
].join('\n');

interface AssistantPayload {
  intent: AssistantIntent;
  reply: string;
  severity: DiagnosticSeverity | null;
  confidence: number;
  likelyCauses: { cause: string; likelihood: 'LOW' | 'MEDIUM' | 'HIGH'; whyItFits: string }[];
  checks: string[];
  recommendedNextSteps: string[];
  recommendedVehicleIds: string[];
}

interface MessageMetadata {
  intent: AssistantIntent;
  recommendedVehicleIds: string[];
}

// Corta antes de gastar una llamada si no hay key: 503 para distinguirlo de una caída real del proveedor.
export function assertAiAvailable(): void {
  if (!aiAvailable()) {
    throw new AppError(503, 'AI_UNAVAILABLE', 'El asistente con IA no esta disponible: falta configurar GROQ_API_KEY');
  }
}

export function diagnosticsAvailable(): boolean {
  return aiAvailable();
}

// Contexto del vehículo del usuario como texto para el prompt.
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
  if (input.mileage) lines.push(`Kilometraje: ${input.mileage.toLocaleString('en-US')} km`);
  if (input.engine) lines.push(`Motor: ${input.engine}`);
  if (input.transmission) lines.push(`Cambio: ${input.transmission}`);
  if (input.fuel) lines.push(`Combustible: ${input.fuel}`);
  return lines.length > 0 ? lines.join('\n') : undefined;
}

// No se confía en el JSON del modelo: enums inválidos se normalizan y los ids se filtran contra el catálogo enviado.
function normalize(raw: unknown, allowedIds: Set<string>): AssistantPayload {
  const o = (raw ?? {}) as Record<string, unknown>;

  const rawIntent = String(o.intent ?? '').toUpperCase() as AssistantIntent;
  const intent: AssistantIntent = INTENTS.includes(rawIntent) ? rawIntent : 'GENERAL';

  const rawSeverity = String(o.severity ?? '').toUpperCase() as DiagnosticSeverity;
  const severity = intent === 'DIAGNOSIS' ? (SEVERITIES.includes(rawSeverity) ? rawSeverity : 'MEDIUM') : null;

  const rawConfidence = Number(o.confidence);
  const confidence = Number.isFinite(rawConfidence) ? Math.min(1, Math.max(0, rawConfidence)) : 0.5;

  const asStringArray = (value: unknown, max: number): string[] =>
    Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean).slice(0, max)
      : [];

  const likelyCauses = (Array.isArray(o.likelyCauses) ? o.likelyCauses : [])
    .slice(0, 4)
    .map((entry) => {
      const e = (entry ?? {}) as Record<string, unknown>;
      const likelihood = String(e.likelihood ?? '').toUpperCase();
      return {
        cause: typeof e.cause === 'string' ? e.cause.trim() : '',
        likelihood: (LIKELIHOODS as readonly string[]).includes(likelihood) ? (likelihood as 'LOW' | 'MEDIUM' | 'HIGH') : 'MEDIUM',
        whyItFits: typeof e.whyItFits === 'string' ? e.whyItFits.trim() : '',
      };
    })
    .filter((c) => c.cause.length > 0);

  const reply = typeof o.reply === 'string' && o.reply.trim() ? o.reply.trim() : 'No pude armar una respuesta para esto. ¿Podés darme más detalles?';

  return {
    intent,
    reply,
    severity,
    confidence,
    likelyCauses: intent === 'DIAGNOSIS' ? likelyCauses : [],
    checks: asStringArray(o.checks, 6),
    recommendedNextSteps: asStringArray(o.recommendedNextSteps, 5),
    recommendedVehicleIds: asStringArray(o.recommendedVehicleIds, 3).filter((id) => allowedIds.has(id)),
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

export interface RecommendedVehicleDto {
  id: string;
  title: string;
  year: number;
  basePrice: number;
  saleType: SaleType;
  imageUrl: string | null;
  // Id de la subasta en vivo, para que la app abra la sala de pujas en vez de la ficha.
  auctionId: string | null;
}

export interface DiagnosticMessageDto {
  id: string;
  sender: 'USER' | 'AI_ASSISTANT';
  content: string;
  model: string | null;
  intent: AssistantIntent | null;
  recommendations: RecommendedVehicleDto[];
  createdAt: string;
}

export interface AiDiagnosticDetailDto extends AiDiagnosticDto {
  messages: DiagnosticMessageDto[];
}

// Los campos de la fila, sin el hilo. Base del detalle y de los listados.
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

function readMetadata(value: unknown): MessageMetadata | null {
  const o = value as Partial<MessageMetadata> | null;
  return o && typeof o === 'object' && Array.isArray(o.recommendedVehicleIds)
    ? { intent: o.intent ?? 'GENERAL', recommendedVehicleIds: o.recommendedVehicleIds }
    : null;
}

// Las recomendaciones se resuelven al leer y no al guardar: si el auto se vendió, deja de aparecer en el hilo.
async function toDiagnosticDto(row: DiagnosticRow): Promise<AiDiagnosticDetailDto> {
  const ids = [...new Set(row.messages.flatMap((m) => readMetadata(m.metadata)?.recommendedVehicleIds ?? []))];
  const vehicles = ids.length
    ? await prisma.vehicle.findMany({
        where: { id: { in: ids }, deletedAt: null, status: { in: ['AVAILABLE', 'IN_AUCTION'] } },
        include: { images: { orderBy: { position: 'asc' }, take: 1 }, auction: { select: { id: true, status: true } } },
      })
    : [];
  const byId = new Map(
    vehicles.map((v) => [
      v.id,
      {
        id: v.id,
        title: `${v.brand} ${v.model}`,
        year: v.year,
        basePrice: Number(v.basePrice),
        saleType: v.saleType,
        imageUrl: v.images[0]?.url ?? null,
        auctionId: v.auction?.status === 'ACTIVE' ? v.auction.id : null,
      } satisfies RecommendedVehicleDto,
    ]),
  );

  return {
    ...toDiagnosticFields(row),
    messages: row.messages.map((m) => {
      const metadata = readMetadata(m.metadata);
      return {
        id: m.id,
        sender: m.sender,
        content: m.content,
        model: m.model,
        intent: metadata?.intent ?? null,
        recommendations: (metadata?.recommendedVehicleIds ?? []).flatMap((id) => byId.get(id) ?? []),
        createdAt: m.createdAt.toISOString(),
      };
    }),
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
// Groq gratis limita tokens por minuto: el historial que se reenvía se corta a los últimos turnos.
const MAX_HISTORY_TURNS = 8;

// La fila se crea antes de llamar al modelo: si falla, la pregunta queda guardada para reintentar.
export async function createDiagnostic(userId: string, input: CreateDiagnosticInput): Promise<AiDiagnosticDetailDto> {
  const title = input.title.trim();
  if (!title) {
    throw AppError.badRequest('Validation failed', { title: 'title no puede estar vacio' });
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw AppError.badRequest('Validation failed', { title: `title admite hasta ${MAX_TITLE_LENGTH} caracteres` });
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

  // Si viene de la ficha de un vehículo, sus datos son mejores que los que el usuario pueda tipear.
  if (input.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: input.vehicleId, deletedAt: null },
      select: { id: true, brand: true, model: true, year: true, mileage: true, engine: true, transmission: true, fuel: true },
    });
    if (!vehicle) throw AppError.notFound('Vehicle');
    vehicleSnapshot = vehicle;
  }

  // Después de validar la entrada: un vehicleId inexistente tiene que dar 404 haya o no key configurada.
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
  });

  // Lo que no entró en el título viaja completo en symptoms.description: ese es el turno real del usuario.
  const description = (input.symptoms as { description?: unknown } | undefined)?.description;
  await prisma.aiDiagnosticMessage.create({
    data: { diagnosticId: diagnostic.id, sender: 'USER', content: typeof description === 'string' ? description : title },
  });

  try {
    await runDiagnosis(diagnostic.id);
  } catch (err) {
    throw withDiagnosticId(err, diagnostic.id);
  }

  const fresh = await prisma.aiDiagnostic.findUniqueOrThrow({ where: { id: diagnostic.id }, include: DIAGNOSTIC_INCLUDE });
  return toDiagnosticDto(fresh);
}

// Le engancha el id del diagnóstico al error del proveedor, para que el cliente lo recupere.
function withDiagnosticId(err: unknown, diagnosticId: string): AppError {
  if (err instanceof AppError) {
    return new AppError(err.statusCode, err.code, err.message, { diagnosticId });
  }
  throw err;
}

// Convierte un error del proveedor en algo que el usuario pueda actuar.
function toAppError(err: unknown): AppError {
  if (err instanceof AiError) {
    if (err.retryable) {
      return new AppError(503, 'AI_UNAVAILABLE', `El asistente no respondio: ${err.message}`);
    }
    return new AppError(502, 'AI_ERROR', `El asistente fallo: ${err.message}`);
  }
  throw err;
}

// El último turno va como mensaje final: así un seguimiento se responde a sí mismo y no repite la primera respuesta.
export async function runDiagnosis(diagnosticId: string): Promise<Partial<AiDiagnosticDto>> {
  const diagnostic = await prisma.aiDiagnostic.findUniqueOrThrow({
    where: { id: diagnosticId },
    select: {
      id: true, userId: true, title: true, vehicleBrand: true, vehicleModel: true, vehicleYear: true, mileage: true,
      messages: { orderBy: { createdAt: 'asc' }, select: { sender: true, content: true } },
    },
  });

  const turns = diagnostic.messages.slice(-MAX_HISTORY_TURNS);
  const lastUserTurn = [...turns].reverse().find((m) => m.sender === 'USER')?.content ?? diagnostic.title;
  const userText = turns.filter((m) => m.sender === 'USER').map((m) => m.content).join('\n');

  const catalog = await buildCatalogContext(userText);
  const vehicleContext = buildVehicleContext({
    brand: diagnostic.vehicleBrand,
    model: diagnostic.vehicleModel,
    year: diagnostic.vehicleYear,
    mileage: diagnostic.mileage,
  });

  const context = [
    vehicleContext ? `VEHÍCULO DEL USUARIO:\n${vehicleContext}` : null,
    catalog.length
      ? `CATÁLOGO DISPONIBLE (id | vehículo | categoría | combustible | transmisión | km | mecánica | precio):\n${catalog.map((c) => c.line).join('\n')}`
      : 'CATÁLOGO DISPONIBLE: no hay vehículos publicados en este momento.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: context },
    ...turns.slice(0, -1).map((m): ChatMessage => ({ role: m.sender === 'USER' ? 'user' : 'assistant', content: m.content })),
    { role: 'user', content: lastUserTurn },
  ];

  let data: AssistantPayload;
  let model: string;
  try {
    const response = await chatJson<unknown>({ messages, temperature: 0.3, maxTokens: 1500 });
    data = normalize(response.data, new Set(catalog.map((c) => c.id)));
    model = response.model;
  } catch (err) {
    throw toAppError(err);
  }

  const metadata: MessageMetadata = { intent: data.intent, recommendedVehicleIds: data.recommendedVehicleIds };
  const isDiagnosis = data.intent === 'DIAGNOSIS';

  const [, message] = await prisma.$transaction([
    // Solo un diagnóstico mueve el veredicto de la conversación: una recomendación o un fuera de tema no lo pisan.
    prisma.aiDiagnostic.update({
      where: { id: diagnosticId },
      data: isDiagnosis ? { summary: data.reply, severity: data.severity, confidence: data.confidence } : {},
    }),
    prisma.aiDiagnosticMessage.create({
      data: {
        diagnosticId,
        sender: 'AI_ASSISTANT',
        content: renderReply(data),
        model,
        promptSnapshot: lastUserTurn,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);

  // Después del commit: emitir adentro mostraría una respuesta que todavía puede no guardarse.
  emitDiagnosticDone({
    userId: diagnostic.userId,
    diagnosticId,
    summary: data.reply,
    severity: data.severity,
    confidence: data.confidence,
  });

  return {
    summary: isDiagnosis ? data.reply : undefined,
    severity: data.severity,
    confidence: data.confidence,
    updatedAt: message.createdAt.toISOString(),
  };
}

const SEVERITY_TEXT: Record<DiagnosticSeverity, string> = {
  LOW: 'leve',
  MEDIUM: 'media',
  HIGH: 'alta',
  CRITICAL: 'crítica',
};

const LIKELIHOOD_TEXT = { LOW: 'poco probable', MEDIUM: 'probable', HIGH: 'muy probable' } as const;

// El texto que se guarda y se muestra en la burbuja: el JSON del modelo, legible.
function renderReply(d: AssistantPayload): string {
  const lines: string[] = [d.reply];
  if (d.severity) lines.push('', `Severidad: ${SEVERITY_TEXT[d.severity]}`);

  if (d.likelyCauses.length > 0) {
    lines.push('', 'Causas probables:');
    for (const c of d.likelyCauses) lines.push(`- ${c.cause} (${LIKELIHOOD_TEXT[c.likelihood]})${c.whyItFits ? `: ${c.whyItFits}` : ''}`);
  }
  if (d.checks.length > 0) {
    lines.push('', 'Podés revisar:');
    for (const c of d.checks) lines.push(`- ${c}`);
  }
  if (d.recommendedNextSteps.length > 0) {
    lines.push('', 'Qué hacer:');
    for (const s of d.recommendedNextSteps) lines.push(`- ${s}`);
  }
  if (d.intent === 'DIAGNOSIS') lines.push('', 'Esto es orientativo y no reemplaza una inspección en un taller.');
  return lines.join('\n');
}

export async function listDiagnostics(
  userId: string,
  page: { skip: number; take: number },
): Promise<{ rows: AiDiagnosticDto[]; total: number }> {
  // El listado no trae el hilo: es el detalle de `GET /:id`.
  const [total, rows] = await prisma.$transaction([
    prisma.aiDiagnostic.count({ where: { userId } }),
    prisma.aiDiagnostic.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: page.skip, take: page.take }),
  ]);
  return { rows: rows.map(toDiagnosticFields), total };
}

export async function getDiagnostic(userId: string, diagnosticId: string): Promise<AiDiagnosticDetailDto> {
  const diagnostic = await prisma.aiDiagnostic.findFirst({ where: { id: diagnosticId, userId }, include: DIAGNOSTIC_INCLUDE });
  if (!diagnostic) throw AppError.notFound('Diagnostic');
  return toDiagnosticDto(diagnostic);
}

// Un diagnóstico pertenece a su autor: `findFirst` con `userId`, no con id.
export async function markResolved(userId: string, diagnosticId: string, resolved: boolean): Promise<AiDiagnosticDto> {
  const row = await prisma.aiDiagnostic.findFirst({ where: { id: diagnosticId, userId }, select: { id: true } });
  if (!row) throw AppError.notFound('Diagnostic');
  const updated = await prisma.aiDiagnostic.update({ where: { id: diagnosticId }, data: { resolved } });
  return toDiagnosticFields(updated);
}

// Pregunta de seguimiento: devuelve la respuesta y el hilo actualizado con sus recomendaciones.
export async function askFollowUp(
  userId: string,
  diagnosticId: string,
  question: string,
): Promise<{ answer: string; diagnostic: AiDiagnosticDetailDto }> {
  const diagnostic = await prisma.aiDiagnostic.findFirst({ where: { id: diagnosticId, userId }, select: { id: true } });
  if (!diagnostic) throw AppError.notFound('Diagnostic');

  const questionTrimmed = question.trim();
  if (!questionTrimmed) {
    throw AppError.badRequest('Validation failed', { question: 'question no puede estar vacia' });
  }

  // Sin key no se guarda la pregunta, para no dejar un turno del usuario que nunca va a tener respuesta.
  assertAiAvailable();

  await prisma.aiDiagnosticMessage.create({ data: { diagnosticId, sender: 'USER', content: questionTrimmed } });
  await runDiagnosis(diagnostic.id);

  const fresh = await getDiagnostic(userId, diagnosticId);
  const last = [...fresh.messages].reverse().find((m) => m.sender === 'AI_ASSISTANT');
  return { answer: last?.content ?? '', diagnostic: fresh };
}

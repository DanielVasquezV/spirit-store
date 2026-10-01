import { config } from 'dotenv';

// Prueba del asistente contra la API levantada y el seed demo: pnpm --filter @spirit-store/backend ai:check

config({ path: '../.env' });

const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}/api`;
const EMAIL = 'carlos@spirit.dev';
const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'spirit-demo-123';

type Message = { sender: string; content: string; intent: string | null; recommendations: { id: string; title: string; basePrice: number }[] };
type Diagnostic = { id: string; severity: string | null; messages: Message[] };

async function call<T>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json()) as { success: boolean; data: T; error?: { code: string; message: string } };
  if (!payload.success) throw new Error(`${method} ${path} -> ${response.status} ${payload.error?.code}: ${payload.error?.message}`);
  return payload.data;
}

const lastReply = (d: Diagnostic) => [...d.messages].reverse().find((m) => m.sender === 'AI_ASSISTANT')!;

let failures = 0;
function expect(label: string, condition: boolean, detail: string): void {
  console.log(`${condition ? '  ✓' : '  ✗'} ${label}${condition ? '' : ` — ${detail}`}`);
  if (!condition) failures += 1;
}

async function main(): Promise<void> {
  const { accessToken } = await call<{ accessToken: string }>('POST', '/auth/login', undefined, { email: EMAIL, password: PASSWORD });
  const { available } = await call<{ available: boolean }>('GET', '/diagnostics/availability', accessToken);
  if (!available) throw new Error('El asistente no está disponible: falta GROQ_API_KEY en .env');

  console.log('\n1. Diagnóstico de una falla de frenos');
  let started = Date.now();
  const brakes = await call<Diagnostic>('POST', '/diagnostics', accessToken, {
    title: 'Cuando freno el carro chilla y el pedal se siente esponjoso',
  });
  let reply = lastReply(brakes);
  console.log(`  (${Date.now() - started} ms) ${reply.content.split('\n')[0]}`);
  expect('intent DIAGNOSIS', reply.intent === 'DIAGNOSIS', `fue ${reply.intent}`);
  expect('severidad alta o crítica (frenos)', ['HIGH', 'CRITICAL'].includes(brakes.severity ?? ''), `fue ${brakes.severity}`);

  console.log('\n2. Seguimiento sobre el mismo hilo');
  started = Date.now();
  const followUp = await call<{ answer: string; diagnostic: Diagnostic }>('POST', `/diagnostics/${brakes.id}/ask`, accessToken, {
    question: '¿Puedo seguir manejando así hasta el fin de semana?',
  });
  console.log(`  (${Date.now() - started} ms) ${followUp.answer.split('\n')[0]}`);
  expect('responde la pregunta nueva y no repite la primera', followUp.answer !== reply.content, 'respuesta idéntica a la anterior');

  console.log('\n3. Recomendación con presupuesto sobre el catálogo interno');
  started = Date.now();
  const recommend = await call<Diagnostic>('POST', '/diagnostics', accessToken, {
    title: 'Busco una camioneta familiar que gaste poco, presupuesto de 38 mil',
  });
  reply = lastReply(recommend);
  console.log(`  (${Date.now() - started} ms) ${reply.content.split('\n')[0]}`);
  for (const v of reply.recommendations) console.log(`    → ${v.title} $${v.basePrice}`);
  expect('intent RECOMMENDATION', reply.intent === 'RECOMMENDATION', `fue ${reply.intent}`);
  expect('recomienda al menos un vehículo del catálogo', reply.recommendations.length > 0, 'sin recomendaciones');
  expect('respeta el presupuesto (+15%)', reply.recommendations.every((v) => v.basePrice <= 38000 * 1.15), 'recomendó algo más caro');

  console.log('\n4. Pregunta fuera de tema');
  const offTopic = await call<Diagnostic>('POST', '/diagnostics', accessToken, { title: '¿Me das una receta de pupusas revueltas?' });
  reply = lastReply(offTopic);
  console.log(`  ${reply.content.split('\n')[0]}`);
  expect('intent OFF_TOPIC', reply.intent === 'OFF_TOPIC', `fue ${reply.intent}`);
  expect('no recomienda vehículos', reply.recommendations.length === 0, 'recomendó vehículos');

  console.log(failures === 0 ? '\nTodo OK' : `\n${failures} verificación(es) fallaron`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exitCode = 1;
});

# Prompt — Plan de integración Frontend ↔ API (Spirit Store)

> Copia todo lo que está debajo de la línea en una sesión nueva (idealmente en **modo plan**).

---

## Contexto

Trabajas en el monorepo **Spirit Store**, un marketplace móvil de vehículos:

- `frontend/` — Expo SDK 54 + React Native + expo-router. Código en `frontend/src/`, alias `@/`. Las pantallas viven en `frontend/src/app/` y hoy se alimentan de `frontend/src/lib/mock-data.ts`.
- `backend/` — Node.js (ESM) + Express 5.2 + PostgreSQL 16 + pgvector + Prisma 7.10 + Socket.IO + TypeScript strict.

Se supone que **todas las vistas del frontend ya están construidas**. El objetivo es **conectarlas a la API real**, construir o terminar en el backend lo que falte para que eso funcione, y al final **reportar todo lo que no encajó** entre front, back y base de datos. La base de datos es la fuente de verdad: front y back deben coincidir con ella.

La especificación de referencia es el documento **"Spirit Store — Documento de Diseño del Backend"** (septiembre 2026). Abajo está resumido lo que importa. Si el código actual contradice el documento, **no lo resuelvas en silencio**: anótalo en el reporte final (ver Fase 4).

Antes de tocar cualquier cosa, lee y respeta `AGENTS.md`:
- `.skills/spirit-store-design/SKILL.md` antes de modificar cualquier UI (estados de carga, error o vacío incluidos).
- `.skills/code-comments/SKILL.md` en todo `.ts`/`.tsx` (una línea, en español, que explique el porqué).
- Archivos en kebab-case, primitivos de UI en `frontend/src/components/ui/`, nunca hardcodear colores, fuentes ni spacing (usar `@/constants/theme`).
- APIs de Expo: consultar https://docs.expo.dev/versions/v54.0.0/

---

## Especificación del backend (resumen del documento)

### §1 Correcciones obligatorias al schema Prisma
1. `User.password` → `password_hash` (argon2id). El hash **nunca** sale en DTOs ni en JSON.
2. `User.name` → `full_name`, más `phone_number`, `dui_photo_url`, `dui_status` (`NONE|PENDING|VERIFIED|REJECTED`) y `dui_verified_at`.
3. `role` queda como `USER|ADMIN`, y ADMIN es solo para moderación. Todo usuario es comprador y vendedor a la vez. El registro rechaza `role` (Zod `.strict()`).
4. `orders.vehicle_id` es `@unique`: 1 vehículo tiene como máximo 1 orden activa o completada.
5. `CREATE EXTENSION IF NOT EXISTS vector` + `description_embedding Unsupported("vector(1536)")` + índice HNSW.
6. El IVA (13%) se calcula **en el servidor** en `POST /api/orders`. `cart.tsx` deja de calcularlo y solo muestra los montos que devuelve la API.
7. No existe tabla de carrito: el carrito es UI local y la orden nace de un `vehicleId`.

### §3 Mapa pantalla → endpoints (prefijo global `/api`)
| Pantalla frontend | Endpoints |
|---|---|
| `app/index.tsx` (Splash) | `GET /health` · `GET /auth/me` |
| `app/login.tsx` | `POST /auth/login` |
| `app/register.tsx` | `POST /auth/register` `{ full_name, email, phone, password }` |
| ¿Olvidaste tu contraseña? | `POST /auth/forgot-password` · `POST /auth/reset-password` |
| `app/(tabs)/index.tsx` (Home) | `GET /vehicles?featured=true&limit=6` · `GET /taxonomies` |
| `app/(tabs)/search.tsx` + Sheet de filtros | `GET /vehicles?q&category&transmission&fuel&priceMin&priceMax&sort&cursor&limit` |
| `app/product/[id].tsx` | `GET /vehicles/:id` · `GET /vehicles/:id/availability` · `GET /vehicles/:id/similar` |
| Publicar vehículo | `POST /vehicles` · `PATCH /vehicles/:id` · `DELETE /vehicles/:id` |
| Subir documento (DUI / fotos) | `POST /uploads/presign` · `POST /users/me/dui` |
| Galería (`product-card.tsx`) | `POST /vehicles/:id/images/presign` · `POST /vehicles/:id/images` |
| `app/(tabs)/auctions.tsx` | `GET /auctions?status=ACTIVE` |
| `auction-card.tsx` / detalle | `GET /auctions/:id` · `POST /auctions/:id/bids` · `GET /auctions/:id/bids?cursor` |
| `app/cart.tsx` (Checkout) | `POST /orders` · `POST /orders/:id/checkout-session` |
| `app/(tabs)/chats.tsx` | `GET /chats?box=buy\|sell` |
| `app/chat/[id].tsx` | `POST /chats` · `GET /chats/:id/messages?cursor` · `POST /chats/:id/messages` |
| Oferta en chat | `POST /chats/:id/messages/:messageId/accept` (crea una Order) |
| `app/diagnostics.tsx` | `POST /ai/diagnostics` · `POST /ai/diagnostics/:id/messages` |
| `app/(tabs)/profile.tsx` | `GET /users/me` · `PATCH /users/me` · `GET /users/me/vehicles` · `GET /users/me/auctions` |
| Webhook de pagos | `POST /webhooks/stripe` |

**Formato de error estándar:** `{ "message": string, "code": string, "errors"?: { [campo]: string[] } }`.
Códigos que el front debe manejar: `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `TOKEN_REUSE_DETECTED`, `VALIDATION_ERROR`/`VALIDATION_FAILED`, `RATE_LIMITED` (429 + `Retry-After`), `PAYLOAD_TOO_LARGE`, `DUI_VERIFICATION_REQUIRED` (403, redirige a "Subir documento"), `VIN_INVALID_OR_EXISTS`, `INVALID_VEHICLE_DATA`, `AUCTION_NOT_ACTIVE` (409), `SELF_BID_FORBIDDEN` (403), `BID_TOO_LOW` (422 con `minValid`), `VEHICLE_ALREADY_RESERVED` (409), `SERIALIZABLE_RETRY_EXHAUSTED` (500).

### §4 Modelo de datos (campos clave)
- **USERS**: id uuid, email UK, password_hash, full_name, phone_number (E.164), role, dui_photo_url, dui_status, dui_verified_at, is_active.
- **VEHICLES**: id, seller_id, vin UK (17 caracteres), brand, model, year, base_price decimal, sale_type `DIRECT_SALE|AUCTION|BOTH`, status `DRAFT|PENDING_VERIFICATION|AVAILABLE|IN_AUCTION|RESERVED|SOLD|REJECTED`, description_embedding, search_vector (tsvector generado).
- **VEHICLE_IMAGES** (1..n por vehículo, resuelve un UPLOAD).
- **ORDERS**: order_number UK, vehicle_id UK, buyer_id, seller_id, subtotal, tax_rate (snapshot 0.13), tax_amount, total_amount, status `PENDING_PAYMENT|PAID|FAILED|CANCELLED|REFUNDED`, payment_status `PENDING|COMPLETED|FAILED|REFUNDED`, gateway_session_id.
- **AUCTIONS**: vehicle_id (1 subasta activa por vehículo), starting_price, current_bid, min_increment (5.00), current_winner_id, end_time, status `PENDING|ACTIVE|FINISHED|CANCELLED|NO_BIDS`.
- **BIDS** (índice `auction_id, amount DESC`).
- **CHATS**: vehicle_id, buyer_id, seller_id, chat_type `PURCHASE|SALE|AUCTION_WIN`.
- **MESSAGES**: chat_id, sender_id, message_type `TEXT|IMAGE|OFFER`, offer_status `PENDING|ACCEPTED|REJECTED`, read_at.
- **REFRESH_TOKENS**: token_hash sha256 UK, family_id, replaced_by_id, revoked_at.
- **UPLOADS**: kind `VEHICLE_IMAGE|DUI_PHOTO`, status `PENDING|READY|ATTACHED|REJECTED`.
- **AI_DIAGNOSTICS** y **AI_DIAGNOSTIC_MESSAGES** (opcionalmente ligados a un vehículo).
- El documento habla de **15 tablas**, pero no las detalla todas: identifica cuáles faltan.

### §5 Pujas
`POST /auctions/:id/bids { amount }` → transacción SERIALIZABLE con `FOR UPDATE` y reintento ×3 ante P2034. Valida que esté ACTIVE y dentro de tiempo, que bidder ≠ seller y que `amount ≥ current_bid + min_increment`. **Anti-snipe:** si faltan menos de 30 s, `end_time += 30 s`. Respuesta `201 { bid, auction, nextMinBid }`, y luego emite `auction:bid` por socket. Rate limit de 30/min.

### §6 Auth
Access JWT de 15 min + refresh de 30 días, rotativo por familia. Con `401 TOKEN_EXPIRED` → `POST /auth/refresh { refreshToken }` → `{ accessToken, refreshToken }`. Con `401 TOKEN_REUSE_DETECTED` → el front borra los tokens y redirige a `/login`. Register y login devuelven `{ user, accessToken, refreshToken }`.

### §7 Contrato Socket.IO (handshake con JWT)
Salas: `auction:{id}`, `user:{id}`, `chat:{id}`.
| Dir | Evento | Payload |
|---|---|---|
| C→S | `auction:bid` | `{ auctionId, amount }` → `ack({ ok, bid?, error? })` |
| C→S | `chat:send` | `{ chatId, content, messageType, amount? }` |
| C→S | `chat:read` | `{ chatId }` |
| S→C | `auction:bid` | `{ auctionId, bid, currentBid, currentWinner, endTime, nextMinBid, bidsCount }` |
| S→C | `auction:closed` | `{ auctionId, winnerId, orderId? }` |
| S→C | `chat:message` | `{ chatId, message: MessageDTO }` |
| S→C | `user:notification` | `{ type: 'AUCTION_WON' \| 'OFFER_RECEIVED', payload }` |
| S→C | `order:paid` | (aparece en §8 pero no está en la tabla del contrato) |

### §8 Checkout
`POST /orders { vehicleId, paymentMethod }` → bloquea el vehículo, valida que buyer ≠ seller y que el vehículo esté AVAILABLE, calcula `subtotal = base_price`, `tax = halfEven(subtotal*0.13, 2)` y `total`, crea la orden en PENDING_PAYMENT y deja el vehículo en RESERVED. Después `POST /orders/:id/checkout-session` → `{ clientSecret }` (Stripe PaymentIntent) → la app confirma con el Stripe Mobile SDK → el webhook marca PAID/COMPLETED y el vehículo SOLD → socket `order:paid`. Un cron cancela las órdenes PENDING_PAYMENT de más de 30 min y libera el vehículo.

### §9 Búsqueda
Validación con Zod (`limit` 1–50, `cursor` opaco en base64). Sin `q` → SQL con filtros + keyset. Con `q` → vectorial + full-text fusionados con RRF k=60 (o solo FTS si no hay embeddings). Respuesta `{ data: VehicleDTO[], nextCursor }`. **El backend mapea los enums EN a las etiquetas ES que espera `mock-data.ts`** (p. ej. `AUTOMATIC → 'Automática'`, `GASOLINE → 'Gasolina'`) vía `services/taxonomy.ts`.

### §10 Estructura del backend
`backend/src/{index.ts, app.ts, config/env.ts, lib/{env-loader,prisma,prisma-tx,event-bus,pagination}.ts, middleware/{error-handler,auth,validate,rate-limit,upload}.ts, modules/{auth,users,vehicles,images,search,auctions,bids,orders,chats,ai-diagnostics,uploads}/, realtime/{index,guards}.ts + handlers/, services/{hash,tokens,money,embeddings,storage,payments,taxonomy,sockets}.ts, jobs/{scheduler,close-auctions.job,expire-orders.job,settle-embeddings.job}.ts}`.

### §11 Gate de publicación
`POST /vehicles`: auth → `dui_status == VERIFIED` (si no, `403 DUI_VERIFICATION_REQUIRED`) → Zod → VIN de 17 caracteres y único → `base_price > 0` y `year` entre 1900 y 2026 → INSERT con `PENDING_VERIFICATION` → encolar embeddings → DIRECT_SALE pasa a AVAILABLE, AUCTION crea una subasta en PENDING → `201 { vehicle }`.

### §12 Env
`PORT=4000`, `CLIENT_URL=http://localhost:8081`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TTL=15m`, `REFRESH_TTL=30d`, `OPENAI_API_KEY`, `EMBEDDING_MODEL=text-embedding-3-small`, `S3_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TAX_RATE=0.13`, `DEFAULT_CURRENCY=USD`.
Dependencias: zod, argon2, jsonwebtoken, socket.io, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, stripe, openai, node-cron, decimal.js.

### §13 Fases sugeridas
1. Infra + Auth → Splash y Login.
2. Vehículos + Búsqueda + DUI → Home, Search y Profile sin mocks.
3. Realtime + Chats + ofertas → Chats.
4. Subastas concurrentes → Subastas.
5. Órdenes + Stripe + IA → Carrito, pago y diagnósticos.

---

## Lo que tienes que hacer

### Fase 0 — Auditoría (solo lectura, sin modificar nada)
1. Inventaria **cada** pantalla de `frontend/src/app/` y cada componente que consuma `mock-data.ts`. Por cada uno anota qué datos muestra, qué acciones dispara y con qué forma de datos trabaja (los tipos de `mock-data.ts`).
2. Inventaria el backend actual: `prisma/schema.prisma`, migraciones, rutas Express registradas, módulos, middlewares, Socket.IO y jobs. Marca qué existe, qué está a medias y qué falta respecto a la especificación.
3. Construye una **matriz de trazabilidad**: `Pantalla → acción/dato → endpoint/evento → modelo Prisma/campo → estado (✅ existe / 🟡 parcial / ❌ falta / ⚠️ no coincide)`.
4. Compara campo por campo: **tipos de `mock-data.ts` ↔ DTOs del backend ↔ columnas de Prisma**. Lista todos los campos que el front usa y que no existen en el ER (sospechosos: `category`, `transmission`, `fuel`, `mileage`, `featured`, `description`, `location`, `color`, imágenes, datos del vendedor, rating, etc.), y también los que existen en la BD pero el front nunca muestra.

### Fase 1 — Plan (preséntamelo y **espera mi aprobación** antes de escribir código)
Entrega un plan por fases (alineado con §13) que incluya:
- **Capa de cliente en el frontend**: cliente HTTP en `frontend/src/lib/api/` con base URL desde config de Expo, `Authorization: Bearer` y refresh automático con cola ante `TOKEN_EXPIRED` (un solo refresh en vuelo), manejo de `TOKEN_REUSE_DETECTED` → logout, parseo del envelope `{ message, code, errors }` y errores tipados. Tokens en `expo-secure-store`. Un módulo por dominio (`auth`, `vehicles`, `auctions`, `orders`, `chats`, `users`, `uploads`, `ai`). Tipos de DTO compartidos o espejados del backend.
- **Estado y fetching**: propone una estrategia (p. ej. TanStack Query) para caché, paginación por cursor (infinite scroll en search, bids y mensajes), estados de carga/error/vacío y pull-to-refresh, todo con los componentes del sistema de diseño.
- **Sesión**: contexto de auth, guard de rutas en expo-router y flujo Splash → `/auth/me`.
- **Realtime**: cliente `socket.io-client` con JWT en el handshake, reconexión con token renovado, join/leave de salas por pantalla, sincronización con la caché (pujas, timer con `endTime` del servidor, mensajes, read receipts, notificaciones).
- **Uploads**: flujo presign → PUT directo a S3/R2 → confirmación (DUI y galería de vehículo).
- **Checkout**: carrito local → `POST /orders` por vehículo → `checkout-session` → Stripe RN SDK (verifica compatibilidad con Expo SDK 54) → esperar `order:paid`. Quitar el cálculo de IVA de `cart.tsx`.
- **Backend faltante**: por cada endpoint, evento o job ❌/🟡, qué archivo crear según §10, qué schema Zod usar y qué migración hace falta.
- **Retiro de `mock-data.ts`**: orden de sustitución y criterio para borrarlo (o reducirlo a seeds de Prisma).
- **Seeds** de desarrollo coherentes con el ER (usuarios con DUI VERIFIED y NONE, vehículos de cada `sale_type` y `status`, subastas activas y por terminar, chats con ofertas).
- **Verificación** por fase: cómo probar cada pantalla de punta a punta (backend levantado + app en simulador).

### Fase 2 — Implementación (después de que apruebe el plan)
Ejecuta fase por fase. Al cerrar cada fase:
- `tsc` limpio en `frontend/` y `backend/`, y el linter si existe.
- Prueba manual del flujo en la app real contra el backend local.
- Resumen corto de lo hecho y de lo que quedó pendiente.

No inventes reglas de negocio. Si algo no está en el documento ni en el código, márcalo como decisión pendiente y sigue con lo demás.

### Fase 3 — Verificación cruzada
Al terminar, recorre de nuevo la matriz de trazabilidad y confirma que:
- Ninguna pantalla importa `mock-data.ts` (salvo que se justifique).
- Cada endpoint del §3 lo consume alguna pantalla, o se explica por qué no.
- Cada pantalla con datos tiene endpoint real.
- Los enums y etiquetas ES coinciden entre BD, `taxonomy.ts` y lo que renderiza el front.
- Los montos (subtotal, IVA, total, pujas) vienen siempre del servidor.

### Fase 4 — Reporte final de discrepancias (obligatorio)
Entrega un reporte con estas secciones:
1. **Conectado y funcionando** — pantalla → endpoints.
2. **Faltó conectar** — qué y por qué (bloqueado por backend, credenciales externas como Stripe, S3 u OpenAI, decisión pendiente).
3. **No encajó front ↔ back ↔ BD** — tabla `campo/flujo | lo que espera el front | lo que da el back | lo que tiene la BD | resolución tomada o propuesta`.
4. **Contradicciones dentro del propio documento**. Revisa al menos estos puntos y di cómo se resolvió cada uno:
   - `422 VALIDATION_FAILED` (§5) vs `VALIDATION_ERROR` (§3/§9/§11).
   - `GET /auth/me` (Splash) vs `GET /users/me` (Profile/§6): ¿son el mismo endpoint?
   - §6 usa un LLM para normalizar el teléfono a E.164. ¿No conviene `libphonenumber-js`, que es determinista?
   - `order:paid` se usa en §8 pero no está en el contrato de sockets del §7.
   - `gateway_session_id` se usa en §8 pero no aparece en el ER del §4.
   - §11: el vehículo entra en `PENDING_VERIFICATION` y en el mismo request pasa a `AVAILABLE`. ¿Quién o qué verifica realmente? ¿Hay moderación ADMIN?
   - `sale_type = BOTH` no tiene rama en el flujo del §11.
   - No está definida la transición de subasta `PENDING → ACTIVE` (quién la activa y cuándo).
   - La puja puede ir por REST (§5) o por socket `auction:bid` (§7): ¿cuál usa el front?
   - Aceptar una oferta en chat crea una Order, pero `orders.vehicle_id` es UNIQUE: ¿qué pasa si la orden anterior se canceló, falló o se reembolsó? ¿La oferta cambia el `subtotal` respecto a `base_price`?
   - `close-auctions.job` "inicia la orden" del ganador: ¿con qué precio y con qué `chat_type AUCTION_WIN`?
   - El carrito admite varios vehículos, pero cada orden es de un solo vehículo: ¿N órdenes y N pagos, o un solo PaymentIntent?
   - `paymentMethod` en `POST /orders` no está definido (valores posibles).
   - Contenido y forma de `GET /taxonomies` y de `GET /vehicles/:id/availability` sin especificar.
   - `forgot-password` / `reset-password` sin tabla de tokens de reset en el ER.
   - "15 tablas" en el ER: listar las que faltan.
   - La nota de "Migración inicial recomendada" del §12 está truncada en el documento.
   - Validación de `year ≤ 2026` fija en el código vs año dinámico.
5. **Decisiones pendientes para mí** — lista concreta de preguntas que necesitan respuesta de negocio.
6. **Siguientes pasos** recomendados.

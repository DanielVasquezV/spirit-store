# Guía de instalación

Pasos para levantar el monorepo en una máquina nueva: frontend (Expo SDK 57),
API (Express) y PostgreSQL (Prisma). El gestor de paquetes es **pnpm**: no usar npm ni yarn.

## 1. Requisitos

| Herramienta | Versión | Uso |
| --- | --- | --- |
| Node.js | >= 22 | API y CLI de Expo |
| pnpm | 11.x (la fija `packageManager` del `package.json`) | Gestor de paquetes del workspace |
| Docker Desktop | Compose v2 | Postgres + Adminer (dev) y pila completa (prod) |
| Git | 2.x | Clonar el repositorio |
| Expo Go | compatible con SDK 57 | App móvil en dispositivo |

Instalar:

```bash
# Node (recomendado nvm/fnm en macOS/Linux; instalador LTS en Windows)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 22

# pnpm con la versión exacta del proyecto (corepack viene con Node)
corepack enable

# Docker Desktop
# https://www.docker.com/products/docker-desktop/

node --version   # >= 22
pnpm --version   # 11.x
docker --version && docker compose version
```

Windows: si PowerShell bloquea scripts (`Set-ExecutionPolicy Restricted`), usa
`pnpm.cmd`, `npx.cmd`.

## 2. Clonar e instalar dependencias

```bash
git clone https://github.com/<usuario>/spirit-store.git
cd spirit-store
pnpm install
pnpm db:generate
```

`pnpm install` instala el workspace (`pnpm-workspace.yaml`: `backend` y `frontend`) con
`nodeLinker: hoisted`, que es el layout plano que mejor resuelven Expo y Metro. Solo
corren los scripts de instalación aprobados en `allowBuilds` (`prisma`,
`@prisma/engines`, `esbuild`, `bcrypt`).

`pnpm db:generate` regenera el cliente Prisma en `backend/src/generated/prisma`, que
está en `.gitignore` y es obligatorio tras clonar.

Si pnpm avisa de un build script nuevo: agregarlo en `allowBuilds` de
`pnpm-workspace.yaml` con `true` o `false`.

## 3. Variables de entorno

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Variables de la raíz (`.env`):

| Variable | Default | Descripción |
| --- | --- | --- |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `spirit_store` / `spirit` / `spirit_password` | Postgres del docker-compose |
| `POSTGRES_PORT` / `ADMINER_PORT` | `5432` / `8080` | Puertos en el host |
| `PORT` | `4000` | Puerto de la API Express |
| `DATABASE_URL` | `postgresql://spirit:spirit_password@localhost:5432/spirit_store?schema=public` | Conexión del backend a Postgres |
| `CLIENT_URL` | `*` | Orígenes CORS (separados por coma) |
| `JWT_SECRET` | — | Obligatorio. Generarlo con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD` | `change-me` / `spirit-demo-123` | Claves de las cuentas del seed |
| `GROQ_API_KEY` | — | Asistente IA. Gratis en https://console.groq.com/keys |
| `AI_BASE_URL` / `AI_MODEL` | Groq / `openai/gpt-oss-120b` | Cualquier API compatible con OpenAI (p. ej. DeepSeek) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | — | Proyecto de Supabase para guardar el DUI y las fotos |
| `SUPABASE_STORAGE_BUCKET` | `spirit-store` | Bucket público; el backend lo crea si no existe |
| `ORDER_EXPIRY_MINUTES` / `AUCTION_ORDER_EXPIRY_HOURS` | `30` / `48` | Tiempo para pagar una compra directa / una subasta ganada |
| `API_PORT` / `WEB_PORT` | `8081` / `8081` | Puertos en prod |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8081` | URL de la API horneada en el bundle web |

Sin `GROQ_API_KEY` el asistente responde `503` y la app lo muestra como no disponible.
Sin `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` la subida de archivos responde `503`.

### Supabase Storage (gratis, sin tarjeta)

1. Crear una cuenta en https://supabase.com y un proyecto nuevo (plan Free: 1 GB de almacenamiento).
2. En el proyecto: **Project Settings → API**.
   - **Project URL** → `SUPABASE_URL` (p. ej. `https://abcdefghij.supabase.co`).
   - **service_role** (en *Project API keys*, botón *Reveal*) → `SUPABASE_SERVICE_ROLE_KEY`. Si el panel muestra
     claves nuevas, usar la **secret key** (`sb_secret_...`).
3. Nada más: el backend crea el bucket `spirit-store` como público en la primera subida.

La clave service_role salta las políticas de seguridad del proyecto: solo va en el `.env` del backend, nunca
en el frontend ni en el repositorio. Las fotos se sirven por la URL pública del bucket.

Variable del frontend (`frontend/.env`):

| Variable | Default | Descripción |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8081` | URL base de la API (leída en `frontend/src/lib/api/env.ts`) |

## 4. Levantar Docker (base de datos)

```bash
pnpm db:up       # Postgres 16 + Adminer
docker compose ps
pnpm db:migrate  # aplicar migraciones + regenerar cliente
pnpm db:seed     # usuarios demo, 19 vehículos, subastas y chats
```

El seed crea `ana@spirit.dev`, `carlos@spirit.dev` (con DUI) y `maria@spirit.dev` (sin DUI),
todos con `SEED_DEMO_PASSWORD`. Una subasta del Jeep Wrangler cierra a los 3 minutos con
Carlos como ganador, para probar el pago de una subasta ganada.

Accesos:

- API health: `curl http://localhost:4000/api/health`
- Swagger: `http://localhost:4000/docs`
- Adminer: `http://localhost:8080` (sistema `PostgreSQL`, servidor `db`, credenciales del `.env`)
- Prisma Studio: `pnpm db:studio`

Sin Docker: apuntar `DATABASE_URL` a un Postgres remoto (Supabase/Neon).

## 5. Backend

```bash
pnpm api:dev     # tsx watch en http://localhost:4000
```

Probar el asistente IA (con la API levantada y `GROQ_API_KEY` cargada):

```bash
pnpm --filter @spirit-store/backend ai:check
```

Typecheck y build:

```bash
pnpm --filter @spirit-store/backend typecheck
pnpm api:build         # genera backend/dist/
```

## 6. Frontend

Web:

```bash
pnpm app:web
```

Dispositivo o emulador con Expo Go:

```bash
pnpm app:start   # escanear el QR con Expo Go
```

| Plataforma | Comando |
| --- | --- |
| Android | `pnpm app:android` |
| iOS (macOS) | `pnpm app:ios` |
| Web | `pnpm app:web` |

`expo-image-picker` es un módulo nativo: en Expo Go ya viene incluido; para builds
nativos (`frontend/ios`, `frontend/android`) correr `npx expo prebuild` antes.

Dispositivo físico conectado a la API: `localhost` en el teléfono apunta al propio
teléfono. Editar `frontend/.env` con la IP local del PC (misma red):

```
EXPO_PUBLIC_API_URL=http://192.168.1.50:8081
```

Reiniciar `expo start`. Windows: permitir el puerto 4000 en el firewall.

## 7. Pagos (simulados)

El proyecto es académico: no hay pasarela real. El checkout reserva el vehículo,
calcula el IVA en el servidor y cobra de forma simulada.

| Medio | Dato de prueba | Resultado |
| --- | --- | --- |
| Tarjeta | `4242 4242 4242 4242`, cualquier fecha futura y CVV | Aprobado |
| Tarjeta | `4000 0000 0000 0002` | Rechazado (402), se puede reintentar |
| Transferencia | Cualquier referencia de 4 a 30 caracteres | Aprobado |

Al backend solo viajan la marca, los últimos 4 dígitos y el titular.

## 8. Ejecutar todo

```bash
pnpm dev     # API (:4000) + Expo web a la vez
```

## 9. Producción

```bash
pnpm build       # compila API (tsc) + exporta web (expo export)
pnpm prod:up     # db + api + web (nginx)
curl http://localhost:4000/api/health
```

- `backend/entrypoint.sh` ejecuta `prisma migrate deploy` y luego `node dist/index.js`.
- La API lee los secretos del `.env` de la raíz (`env_file` en `docker-compose.prod.yml`);
  en producción `GROQ_API_KEY`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son obligatorias.
- El frontend web hornea `EXPO_PUBLIC_API_URL` como build-arg.
- En prod usar credenciales fuertes y volúmenes persistentes para Postgres.

## 10. Comandos (raíz)

| Comando | Descripción |
| --- | --- |
| `pnpm db:up` / `db:down` | Levantar / detener Postgres + Adminer |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:deploy` | `prisma migrate deploy` |
| `pnpm db:generate` | Regenerar cliente Prisma |
| `pnpm db:push` | `prisma db push` |
| `pnpm db:studio` | Abrir Prisma Studio |
| `pnpm db:seed` | Ejecutar seed |
| `pnpm api:dev` / `api:build` / `api:start` | Backend dev / compilar / prod local |
| `pnpm app:start` / `app:android` / `app:ios` / `app:web` | Expo |
| `pnpm dev` | API + Expo web juntos |
| `pnpm typecheck` | Typecheck backend y frontend |
| `pnpm build` | Compilar API + exportar web |
| `pnpm prod:up` / `prod:down` | Pila de producción |

Los scripts de raíz delegan por paquete: `pnpm --filter @spirit-store/<paquete> <script>`.

## 11. Solución de problemas

- Docker no disponible: instalar Docker Desktop o apuntar `DATABASE_URL` a un
  Postgres remoto.
- `ERR_PNPM_IGNORED_BUILDS`: agregar el paquete a `allowBuilds` en `pnpm-workspace.yaml`.
- Expo Go no abre el proyecto: verificar SDK (`npx expo --version`), debe ser 57.
- La app no llega a la API desde el teléfono: `EXPO_PUBLIC_API_URL` con la IP del
  PC, misma red, firewall abierto, reiniciar `expo start`.
- Falta el cliente Prisma (`Cannot find module .../src/generated/prisma`):
  `pnpm db:generate`.
- Puerto ocupado: cambiar la variable correspondiente en `.env`.
- CORS bloqueado: ajustar `CLIENT_URL` en `.env`.
- Typed routes desactualizados: arrancar `expo start` una vez para regenerar
  `.expo/types`.
- `prisma migrate dev` propone borrar `orders_active_vehicle_key`: es el índice único
  parcial creado a mano en la migración `payments_flow_and_ai_metadata` (Prisma no
  modela índices parciales). No aceptar ese cambio.
- Windows con OneDrive/Dropbox: los archivos online-only rompen la instalación
  (`EFTYPE`, `ERROR_BAD_EXE_FORMAT`, paquetes vacíos). Trabajar fuera de la carpeta
  sincronizada o excluir `node_modules`.

# Guía de instalación

Pasos para levantar el monorepo en una máquina nueva: frontend (Expo SDK 54),
API (Express) y PostgreSQL (Prisma).

## 1. Requisitos

| Herramienta | Versión | Uso |
| --- | --- | --- |
| Node.js | >= 22 | API y CLI de Expo (incluye npm) |
| npm | >= 10 | Gestor de paquetes (workspaces) |
| Docker Desktop | Compose v2 | Postgres + Adminer (dev) y pila completa (prod) |
| Git | 2.x | Clonar el repositorio |
| Expo Go | última de la tienda | App móvil en dispositivo |

Instalar:

```bash
# Node (recomendado nvm/fnm en macOS/Linux; instalador LTS en Windows)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 22

# Docker Desktop
# https://www.docker.com/products/docker-desktop/

node --version   # >= 22
npm --version    # >= 10
docker --version && docker compose version
```

Windows: si PowerShell bloquea scripts (`Set-ExecutionPolicy Restricted`), usa
`npm.cmd`, `npx.cmd`.

El proyecto usa **Expo SDK 54**, la versión más reciente soportada por las Expo Go
de Play y App Store. No subir a SDK 55+ si se quiere correr en Expo Go de la tienda.

## 2. Clonar e instalar dependencias

```bash
git clone https://github.com/<usuario>/spirit-store.git
cd spirit-store
npm install
npm run db:generate
```

`npm install` instala los workspaces (`@spirit-store/backend` y
`@spirit-store/frontend`), genera `package-lock.json` y ejecuta los `postinstall`
aprobados en `allowScripts` del root (`prisma`, `@prisma/engines`, `esbuild`,
`unrs-resolver`).

`npm run db:generate` regenera el cliente Prisma en
`backend/src/generated/prisma`, que está en `.gitignore` y es obligatorio tras
clonar.

Si npm pide aprobar un `postinstall` nuevo: `npm approve-scripts <paquete>`.

## 3. Variables de entorno

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Variables de la raíz (`.env`):

| Variable | Default | Descripción |
| --- | --- | --- |
| `POSTGRES_DB` | `spirit_store` | Nombre de la BD |
| `POSTGRES_USER` | `spirit` | Usuario de Postgres |
| `POSTGRES_PASSWORD` | `spirit_password` | Clave de Postgres (cambiar en prod) |
| `POSTGRES_PORT` | `5432` | Puerto de Postgres en el host |
| `ADMINER_PORT` | `8080` | Puerto de Adminer |
| `PORT` | `4000` | Puerto de la API Express |
| `DATABASE_URL` | `postgresql://spirit:spirit_password@localhost:5432/spirit_store?schema=public` | Conexión del backend a Postgres |
| `CLIENT_URL` | `*` | Orígenes CORS (separados por coma) |
| `API_PORT` | `4000` | Puerto de la API en prod |
| `WEB_PORT` | `8081` | Puerto del frontend web en prod |
| `EXPO_PUBLIC_API_URL` | `http://localhost:4000` | URL de la API horneada en el bundle web |

Variable del frontend (`frontend/.env`):

| Variable | Default | Descripción |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:4000` | URL base de la API (leída en `frontend/src/lib/api.ts`) |

## 4. Levantar Docker (base de datos)

```bash
npm run db:up       # Postgres 16 + Adminer
docker compose ps   # contenedores healthy
npm run db:migrate  # aplicar migración inicial + regenerar cliente
npm run db:seed     # opcional: admin@spirit.dev / change-me
```

Accesos:

- API health: `curl http://localhost:4000/api/health`
- Adminer: `http://localhost:8080` (sistema `PostgreSQL`, servidor `db`, credenciales del `.env`)
- Prisma Studio: `npm run db:studio`

Sin Docker: apuntar `DATABASE_URL` a un Postgres remoto (Supabase/Neon).

## 5. Inicializar proyecto backend

```bash
npm run api:dev     # tsx watch en http://localhost:4000
```

Verificación:

```bash
curl http://localhost:4000/api/health      # {"status":"ok",...}
curl http://localhost:4000/api/users       # []
curl http://localhost:4000/api/nope        # 404
```

Endpoints:

```
GET  /api/health
GET  /api/users
GET  /api/users/:id
POST /api/users        # body: { email, name?, password }
```

Typecheck y build:

```bash
npm run typecheck -w @spirit-store/backend
npm run api:build         # genera backend/dist/
```

## 6. Inicializar proyecto frontend

Web:

```bash
npm run app:web
```

Dispositivo o emulador con Expo Go:

```bash
npm run app:start   # escanear el QR con Expo Go
```

| Plataforma | Comando |
| --- | --- |
| Android | `npm run app:android` |
| iOS (macOS) | `npm run app:ios` |
| Web | `npm run app:web` |

Dispositivo físico conectado a la API: `localhost` en el teléfono apunta al propio
teléfono. Editar `frontend/.env` con la IP local del PC (misma red):

```
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000
```

Reiniciar `expo start`. Windows: permitir el puerto 4000 en el firewall.

## 7. Ejecutar todo

```bash
npm run dev     # API (:4000) + Expo web a la vez
```

## 8. Producción

```bash
npm run build       # compila API (tsc) + exporta web (expo export)
npm run prod:up     # db + api + web (nginx)
curl http://localhost:4000/api/health
```

- `backend/entrypoint.sh` ejecuta `prisma migrate deploy` y luego
  `node dist/index.js`.
- El frontend web hornea `EXPO_PUBLIC_API_URL` como build-arg
  (`docker-compose.prod.yml` → `frontend/Dockerfile`).
- En prod usar credenciales fuertes y volúmenes persistentes para Postgres.

## 9. Comandos (raíz)

| Comando | Descripción |
| --- | --- |
| `npm run db:up` / `db:down` | Levantar / detener Postgres + Adminer |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:generate` | Regenerar cliente Prisma |
| `npm run db:push` | `prisma db push` |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run db:seed` | Ejecutar seed |
| `npm run api:dev` / `api:build` / `api:start` | Backend dev / compilar / prod local |
| `npm run app:start` / `app:android` / `app:ios` / `app:web` | Expo |
| `npm run dev` | API + Expo web juntos |
| `npm run typecheck` | Typecheck backend y frontend |
| `npm run build` | Compilar API + exportar web |
| `npm run prod:up` / `prod:down` | Pila de producción |

Los scripts de raíz delegan por workspace: `npm run <script> -w @spirit-store/<paquete>`.

## 10. Solución de problemas

- Docker no disponible: instalar Docker Desktop o apuntar `DATABASE_URL` a un
  Postgres remoto.
- npm bloquea un `postinstall`: `npm approve-scripts <paquete>`.
- Expo Go no abre el proyecto: verificar SDK (`npx expo --version`), debe ser 54.
- La app no llega a la API desde el teléfono: `EXPO_PUBLIC_API_URL` con la IP del
  PC, misma red, firewall abierto, reiniciar `expo start`.
- Falta el cliente Prisma (`Cannot find module .../src/generated/prisma`):
  `npm run db:generate`.
- Puerto ocupado: cambiar la variable correspondiente en `.env`.
- CORS bloqueado: ajustar `CLIENT_URL` en `.env`.
- Typed routes desactualizados: arrancar `expo start` una vez para regenerar
  `.expo/types`.
- Windows con OneDrive/Dropbox: los archivos online-only rompen `npm`
  (`EFTYPE`, `ERROR_BAD_EXE_FORMAT`, paquetes vacíos). Trabajar fuera de la carpeta
  sincronizada o excluir `node_modules`.
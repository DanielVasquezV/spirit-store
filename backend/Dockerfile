# syntax=docker/dockerfile:1

# ============================================================================
# STAGE 1: builder
# Instala dependencias del monorepo (npm workspaces), genera el cliente Prisma
# y compila TypeScript.
# ============================================================================
FROM node:22-slim AS builder

# placeholder: prisma generate no necesita una base de datos real
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

WORKDIR /workspace

# Solo manifiestos -> mejor cache de capas
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

# npm 11: los scripts de build quedarán cubiertos por "allowScripts" (package.json raiz)
RUN npm ci

# Codigo fuente del backend
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/prisma.config.ts
COPY backend/tsconfig.json ./backend/tsconfig.json
COPY backend/src ./backend/src

RUN npm run prisma:generate -w @spirit-store/backend
RUN npm run build -w @spirit-store/backend

# ============================================================================
# STAGE 2: runner
# Dependencias de produccion del monorepo + artifact compilado. Sin tooling dev.
# ============================================================================
FROM node:22-slim AS runner

ENV NODE_ENV=production

WORKDIR /app

# Manifiestos del workspace para instalar SOLO dependencias de produccion.
# npm ci instala el workspace completo (incluye deps prod del frontend, que no
# se usan aqui; es la forma mas simple de quedarse sin tooling de desarrollo).
COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/package-lock.json ./package-lock.json
COPY --from=builder /workspace/backend/package.json ./backend/package.json
COPY --from=builder /workspace/frontend/package.json ./frontend/package.json

RUN npm ci --omit=dev

# Copiamos el codigo compilado y los archivos necesarios para migraciones
COPY --from=builder /workspace/backend/dist ./dist
COPY --from=builder /workspace/backend/prisma ./prisma
COPY --from=builder /workspace/backend/prisma.config.ts ./prisma.config.ts
COPY backend/entrypoint.sh ./entrypoint.sh

# Usuario sin privilegios
RUN chown -R node:node /app
USER node

EXPOSE 4000

ENTRYPOINT ["sh", "./entrypoint.sh"]
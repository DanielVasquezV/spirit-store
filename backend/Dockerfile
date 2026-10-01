# syntax=docker/dockerfile:1

# ============================================================================
# STAGE 1: builder
# Instala dependencias del monorepo (pnpm workspace), genera el cliente Prisma
# y compila TypeScript.
# ============================================================================
FROM node:22-slim AS builder

# placeholder: prisma generate no necesita una base de datos real
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

WORKDIR /workspace
# pnpm viene por corepack con la version fijada en "packageManager" del package.json raiz.
RUN corepack enable

# Solo manifiestos -> mejor cache de capas
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN pnpm install --frozen-lockfile --filter @spirit-store/backend...

# Codigo fuente del backend
COPY backend/prisma ./backend/prisma
COPY backend/prisma.config.ts ./backend/prisma.config.ts
COPY backend/tsconfig.json ./backend/tsconfig.json
COPY backend/src ./backend/src

RUN pnpm --filter @spirit-store/backend prisma:generate
RUN pnpm --filter @spirit-store/backend build

# ============================================================================
# STAGE 2: runner
# Solo dependencias de produccion del backend + artifact compilado.
# ============================================================================
FROM node:22-slim AS runner

ENV NODE_ENV=production
# nodeLinker hoisted: los binarios (prisma) quedan en el node_modules de la raiz del workspace.
ENV PATH=/app/node_modules/.bin:$PATH

WORKDIR /app
RUN corepack enable

COPY --from=builder /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml ./
COPY --from=builder /workspace/backend/package.json ./backend/package.json
COPY --from=builder /workspace/frontend/package.json ./frontend/package.json

RUN pnpm install --prod --frozen-lockfile --filter @spirit-store/backend...

# Codigo compilado y lo necesario para migraciones
COPY --from=builder /workspace/backend/dist ./backend/dist
COPY --from=builder /workspace/backend/prisma ./backend/prisma
COPY --from=builder /workspace/backend/prisma.config.ts ./backend/prisma.config.ts
COPY backend/entrypoint.sh ./backend/entrypoint.sh

# Usuario sin privilegios
RUN chown -R node:node /app
USER node

WORKDIR /app/backend
EXPOSE 4000

ENTRYPOINT ["sh", "./entrypoint.sh"]

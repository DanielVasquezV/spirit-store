# syntax=docker/dockerfile:1

# ============================================================================
# STAGE 1: builder
# Exporta la app Expo (Expo Router + TypeScript) a web estatica.
# ============================================================================
FROM node:22-slim AS builder

WORKDIR /workspace
# pnpm viene por corepack con la version fijada en "packageManager" del package.json raiz.
RUN corepack enable

# Solo manifiestos -> mejor cache de capas
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN pnpm install --frozen-lockfile --filter @spirit-store/frontend...

# La URL de la API se hornea en el bundle en tiempo de build
ARG EXPO_PUBLIC_API_URL=http://localhost:4000
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

COPY frontend ./frontend
RUN pnpm --filter @spirit-store/frontend export:web

# ============================================================================
# STAGE 2: nginx
# Sirve el bundle estatico.
# ============================================================================
FROM nginx:alpine AS runner

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/frontend/dist /usr/share/nginx/html

EXPOSE 80
# syntax=docker/dockerfile:1

# ============================================================================
# STAGE 1: builder
# Exporta la app Expo (Expo Router + TypeScript) a web estatica.
# ============================================================================
FROM node:22-slim AS builder

WORKDIR /workspace

# Solo manifiestos -> mejor cache de capas
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci

# La URL de la API se hornea en el bundle en tiempo de build
ARG EXPO_PUBLIC_API_URL=http://localhost:4000
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

COPY frontend ./frontend
RUN npm run export:web -w @spirit-store/frontend

# ============================================================================
# STAGE 2: nginx
# Sirve el bundle estatico.
# ============================================================================
FROM nginx:alpine AS runner

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/frontend/dist /usr/share/nginx/html

EXPOSE 80
# syntax=docker/dockerfile:1.7

# ────────────────────────────────────────────────────────────────────────────
# Base
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# ────────────────────────────────────────────────────────────────────────────
# Install (with dev deps, cached)
# ────────────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps ./apps
COPY packages ./packages
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile || pnpm install

# ────────────────────────────────────────────────────────────────────────────
# Build every workspace
# ────────────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json .prettierrc ./
COPY config ./config
RUN pnpm build

# ────────────────────────────────────────────────────────────────────────────
# Screener runtime
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS screener
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 8080
CMD ["pnpm", "--filter", "screener", "start"]

# ────────────────────────────────────────────────────────────────────────────
# Web runtime
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS web
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]

# syntax=docker/dockerfile:1.7
# Build context is the repository root: the web app needs @talento/shared.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------- deps ------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --frozen-lockfile --filter @talento/web... --filter @talento/shared

# --------------------------------------------------------------- build ------
FROM deps AS build
# Baked into the bundle at build time; empty means "same origin", which is what
# the nginx reverse proxy in front of both services provides.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @talento/web build

# ------------------------------------------------------------- runtime ------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

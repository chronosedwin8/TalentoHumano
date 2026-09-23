# syntax=docker/dockerfile:1.7
# Build context is the repository root: the API needs @talento/shared.

FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache openssl
WORKDIR /app

# ---------------------------------------------------------------- deps ------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && \
    pnpm install --frozen-lockfile --filter @talento/api... --filter @talento/shared

# --------------------------------------------------------------- build ------
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @talento/shared build && \
    pnpm --filter @talento/api exec prisma generate && \
    pnpm --filter @talento/api build && \
    pnpm prune --prod

# ------------------------------------------------------------- runtime ------
FROM base AS runtime
ENV NODE_ENV=production
# Never run as root, and keep a writable place for the local storage driver.
RUN addgroup -S talento && adduser -S talento -G talento

COPY --from=build --chown=talento:talento /app/node_modules ./node_modules
COPY --from=build --chown=talento:talento /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=talento:talento /app/packages/shared/package.json ./packages/shared/
COPY --from=build --chown=talento:talento /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=talento:talento /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=talento:talento /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=talento:talento /app/apps/api/package.json ./apps/api/

RUN mkdir -p /app/apps/api/storage && chown -R talento:talento /app/apps/api/storage
VOLUME ["/app/apps/api/storage"]

USER talento
WORKDIR /app/apps/api
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]

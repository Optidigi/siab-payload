# syntax=docker/dockerfile:1.7

# 1. Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# 2. Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# PAYLOAD_SECRET / DATABASE_URI must be set at runtime, not build time.
# But payload.config.ts throws if they're missing — provide build-time
# placeholders so `next build` (which evaluates the config) can complete.
ENV PAYLOAD_SECRET=build-time-placeholder
ENV DATABASE_URI=postgres://placeholder@placeholder/placeholder
# Payload's importMap.js is gitignored (it's a generated file). Materialize it
# before `next build` so the (payload)/layout.tsx import resolves. The
# placeholder DB URI is fine — generate:importmap walks the config locally,
# no DB query needed.
RUN corepack enable pnpm && pnpm payload generate:importmap && pnpm build

# 3. Runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache wget && addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --start-period=60s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]

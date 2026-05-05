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
# Payload generates two files at runtime that are .gitignored:
#   - src/payload-types.ts            (TS types for collections; consumed across the app)
#   - src/app/(payload)/admin/importMap.js   (Payload admin layout import)
# Locally they exist from prior dev runs; in CI we must produce both before
# `next build`. Neither command queries the DB — they walk the config —
# so the placeholder DATABASE_URI suffices.
RUN corepack enable pnpm \
 && pnpm payload generate:types \
 && pnpm payload generate:importmap \
 && pnpm build \
 && node scripts/build-runtime-bundle.mjs

# 3. Runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Bind Next.js standalone server to all interfaces. Without this, the server
# binds only to the container hostname, making /api/health (which curls
# localhost:3000) and the Docker healthcheck fail with "connection refused".
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apk add --no-cache wget
# node:22-alpine ships with a `node` user at UID 1000; reuse it (matches the
# host's serveradmin UID 1000 so the bind-mounted /data-out is writable).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Migrate-on-boot bundle: pre-compiled config + migrations + the script that
# applies them. See scripts/migrate-on-boot.mjs for the why.
COPY --from=builder --chown=node:node /app/dist-runtime ./dist-runtime
COPY --from=builder --chown=node:node /app/scripts/migrate-on-boot.mjs ./scripts/migrate-on-boot.mjs
COPY --from=builder --chown=node:node /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --start-period=60s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
ENTRYPOINT ["/bin/sh", "/app/scripts/docker-entrypoint.sh"]

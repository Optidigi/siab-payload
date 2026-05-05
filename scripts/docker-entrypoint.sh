#!/bin/sh
# Container entrypoint. Apply pending DB migrations, then hand off to the
# Next.js standalone server as PID 1 so signals (SIGTERM from `docker stop`)
# reach Node directly.
#
# Migration failure exits non-zero — Docker will restart the container per
# the compose `restart: unless-stopped` policy, surfacing the loop in
# `docker logs siab-payload` and `docker compose ps`.
set -e

echo "[entrypoint] running migrate-on-boot..."
node /app/scripts/migrate-on-boot.mjs

echo "[entrypoint] starting next server..."
exec node /app/server.js

# Local development runbook

Cross-platform setup for running `siab-payload` against a local Docker-based Postgres. Targets a developer who has just cloned the repo and wants `pnpm dev` to come up cleanly.

## Prerequisites

- **Node 22+** — verify with `node -v`
- **pnpm** — install via corepack: `corepack enable pnpm`
- **Container runtime** — Docker or Podman (this machine uses Podman; see note below)
- **Git** — for `git clone`

> **This machine (Shimmy's Linux dev box):** Docker is not installed — use `podman` directly. `docker-compose` / `podman-compose` are also unavailable, so run the container with `podman run` or `podman start` (see Step 2 below).

## Step 1: Clone and install

```bash
git clone https://github.com/Optidigi/siab-payload.git
cd siab-payload
pnpm install
```

## Step 2: Start local Postgres

**Standard (Docker):**
```bash
docker compose -f docker-compose.local.yml up -d
docker compose -f docker-compose.local.yml ps   # status should be "healthy"
```

**This machine (Podman, no compose plugin):**

The named container `siab-payload-postgres-dev` already exists (created 2026-05). Just start it:
```bash
podman start siab-payload-postgres-dev
podman exec siab-payload-postgres-dev pg_isready -U payload -d payload  # should say "accepting connections"
```

If you ever need to recreate it from scratch (e.g. after `podman rm`):
```bash
podman run -d \
  --name siab-payload-postgres-dev \
  -e POSTGRES_DB=payload \
  -e POSTGRES_USER=payload \
  -e POSTGRES_PASSWORD=change-me \
  -p 5432:5432 \
  -v siab-payload-postgres-dev:/var/lib/postgresql/data \
  postgres:17-alpine
```

> **Password note:** The `.env` `DATABASE_URI` must use the password the volume was initialised with (`change-me`). If they diverge you'll get `password authentication failed` — fix by updating `DATABASE_URI` in `.env` to match.

The container is `siab-payload-postgres-dev`, data lives in the named volume `siab-payload-postgres-dev`, and the host port defaults to `5432`.

## Step 3: Local `.env`

Copy the example and edit:

```bash
cp .env.example .env
```

Values to set:

- `PAYLOAD_SECRET` — generate with one of:
  - `openssl rand -hex 32` (Linux/macOS)
  - `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (any platform)
- `DATABASE_URI=postgres://payload:change-me@localhost:5432/payload` — matches the compose defaults; already set in `.env.example`
- `DATA_DIR=./.data-out` — gitignored; Payload writes per-tenant JSON snapshots here
- `NEXT_PUBLIC_SUPER_ADMIN_DOMAIN=siteinabox.nl` — Phase 7's `hostToTenant` falls back to treating `localhost` as super-admin in dev
- `RESEND_API_KEY=` — leave empty in dev. Forgot-password no-ops; Payload still returns 200.
- `EMAIL_FROM=noreply@siteinabox.nl`

## Step 4: First-boot schema push

The Payload Postgres adapter pushes schema in `NODE_ENV=development` automatically on the first DB query. So the simplest path is:

```bash
pnpm dev
# Open http://localhost:3000/admin → Payload's "Create first user" form appears.
# (the page-load triggers a getPayload() init which pushes the schema)
```

If you'd rather match prod and run explicit migrations:

```bash
pnpm payload migrate
```

The repo ships migrations under `src/migrations/`. In production, the
Docker image's entrypoint runs an esbuild-bundled `migrate-on-boot.bundled.mjs`
automatically before `node server.js` — there's no manual migrate step
on deploy. For local development you keep using the CLI as above; the boot
bundle (and the `dist-runtime/` directory it lives in) is only built and
copied inside the Docker image, not in `pnpm dev`.

## Step 5: Create a local super-admin

Either:

- Use Payload's "Create first user" form (open while no users exist), or
- Curl it:

  ```bash
  curl -X POST -H "Content-Type: application/json" \
    -d '{"email":"dev@local","password":"change-me","name":"Dev","role":"super-admin"}' \
    http://localhost:3000/api/users
  ```

Then sign in at http://localhost:3000/login.

## Step 6: Run the test suite

- **Unit tests:** `pnpm test`
- **Integration tests** (require DB up): `pnpm test tests/integration/` — they skip if the DB isn't reachable; with the local compose up they run.
- **E2E tests** (require dev server up + Playwright browser installed):

  ```bash
  pnpm dlx playwright install chromium   # one-time
  pnpm test:e2e
  ```

## Common operations

- **Reset the local DB (lose all data):**
  ```bash
  docker compose -f docker-compose.local.yml down -v
  docker compose -f docker-compose.local.yml up -d
  ```
- **Tail logs:** `pnpm dev` already streams to stdout. For DB logs: `docker logs -f siab-payload-postgres-dev`.
- **Regenerate Payload types after collection edits:** `pnpm payload generate:types`
- **Generate a new migration after collection edits:** `pnpm payload migrate:create my-change-name`
- **Stop everything:** `Ctrl+C` the dev server, then `docker compose -f docker-compose.local.yml stop`

## Platform notes

- **Windows:** Docker Desktop with the WSL2 backend is the recommended setup. PowerShell and Git Bash both work for the commands above.
- **macOS (Apple Silicon):** `postgres:17-alpine` ships an arm64 image — pulls native, no emulation.
- **Linux:** Docker Engine without Desktop is fine. You may need `sudo` for `docker` if your user isn't in the `docker` group.

## Troubleshooting

- **Port 5432 already in use** — another Postgres is running on the host. Either stop it (`brew services stop postgresql` / `sudo systemctl stop postgresql` / Services on Windows), or override the host port: `POSTGRES_HOST_PORT=5433 docker compose -f docker-compose.local.yml up -d` and update `DATABASE_URI` in `.env`.
- **`pnpm dev` errors with "PAYLOAD_SECRET is required"** — copy `.env.example` to `.env` and fill in `PAYLOAD_SECRET`.
- **`relation "users" does not exist`** — the schema didn't push. Hit `/admin` once in the browser to trigger the `getPayload()` init, or run `pnpm payload migrate` explicitly.
- **`/api/health` returns `dataDir: unwritable`** — the `.data-out/` directory needs to be writable by the dev process. On Linux/macOS: `chmod -R 755 .data-out`. On Windows: ensure no antivirus / Defender lock on the folder.

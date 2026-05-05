# Production Deploy Runbook — `siab-payload`

## Overview

This runbook walks a fresh production VPS to a healthy `https://admin.siteinabox.nl`
serving the Payload-based admin console for SiteInABox. Use it for an initial
deploy, recovery from a wiped VPS, or replicating the stack onto a new VPS.

It captures the gotchas hit during the first production deploy so they don't
bite the next operator.

## Prerequisites

Before running anything in this document, the following must be true:

- A VPS with Docker Engine and the Docker Compose v2 plugin installed.
- An `nginx-proxy-manager` stack already running on the host, attached to a
  Docker network named `proxy` that is marked `external: true`.
- A DNS A record `admin.<your-domain>` (e.g. `admin.siteinabox.nl`) pointing at
  the VPS public IP. SSL issuance (Let's Encrypt via NPM) needs this resolving
  before Step 6.
- A GHCR account with read access to `ghcr.io/optidigi/siab-payload` (a
  Personal Access Token with `read:packages` is sufficient). Only required if
  the package is private.
- A non-root deploy user on the host (referred to as `serveradmin` below) with
  membership in the `docker` group.

## Architecture quick-reference

Two containers, one Compose project, two networks:

```
                ┌─────────────────────────────────────┐
                │ nginx-proxy-manager (existing)      │
                │ network: proxy (external)           │
                └─────────────────────┬───────────────┘
                                      │ HTTP :3000
                                      ▼
   ┌─────────────────────┐    ┌───────────────────────┐
   │ siab-payload        │◀──▶│ siab-payload-postgres │
   │ image: ghcr.io/     │    │ image: postgres:17    │
   │   optidigi/         │    │   -alpine             │
   │   siab-payload      │    │                       │
   │ networks:           │    │ networks: internal    │
   │   proxy, internal   │    │                       │
   └─────────────────────┘    └───────────────────────┘
```

- Compose stack lives at `/srv/saas/infra/stacks/siab-payload/`.
- Per-tenant data is bind-mounted to `/srv/data/saas/siab-payload/` on the
  host and surfaces inside the app container at `/data-out`.
- The Postgres volume is a named Docker volume (`postgres-data`).
- Source of truth for compose values: the repo's `docker-compose.yml`.

## Step 1 — VPS directories (requires root)

```bash
sudo mkdir -p /srv/saas/infra/stacks/siab-payload /srv/data/saas/siab-payload
sudo chown -R serveradmin:serveradmin /srv/saas/infra/stacks/siab-payload /srv/data/saas/siab-payload
```

The data dir must end up writable by UID 1000 inside the container — see
Gotcha 2 if you're running the host as a different UID.

## Step 2 — Compose + `.env`

Copy the repo's `docker-compose.yml` to the stack dir verbatim:

```bash
# From a workstation with the repo cloned, or via curl from a tagged release:
scp docker-compose.yml serveradmin@<vps>:/srv/saas/infra/stacks/siab-payload/docker-compose.yml
```

Then write `/srv/saas/infra/stacks/siab-payload/.env` with the following
template. Replace placeholder values; generate the secrets with `openssl`.

```
POSTGRES_PASSWORD=<openssl rand -hex 24>
PAYLOAD_SECRET=<openssl rand -hex 32>
DATA_HOST_PATH=/srv/data/saas/siab-payload
SUPER_ADMIN_DOMAIN=siteinabox.nl
VPS_IP=<your-vps-ip>
RESEND_API_KEY=
EMAIL_FROM=noreply@siteinabox.nl
HOSTNAME=0.0.0.0
```

Lock the file down:

```bash
chmod 600 /srv/saas/infra/stacks/siab-payload/.env
```

**DO NOT wrap values in quotes.** Compose's dotenv parser strips them, but raw
shell tools like `cut` don't, so any helper script that reads `.env`
(including the one in Step 5) will produce values prefixed/suffixed with quote
characters and silently mis-auth against Postgres. Either store everything
unquoted, or strip quotes when reading (the helper in Step 5 does both).

## Step 3 — Login to GHCR (if image is private) and pull

```bash
# Skip if ghcr.io/optidigi/siab-payload is public.
echo "<github-pat>" | docker login ghcr.io -u <github-user> --password-stdin

docker compose -f /srv/saas/infra/stacks/siab-payload/docker-compose.yml pull
```

## Step 4 — Bring up the stack

```bash
cd /srv/saas/infra/stacks/siab-payload
docker compose up -d
docker compose ps
```

The Postgres container should become healthy within ~10s. The app container
will start but will fail health checks until Step 5 has run on a fresh DB
(see Gotcha 1).

## Step 5 — Apply database migrations

Schema is managed via committed migration files under `src/migrations/`.
Run the migrations against the running Postgres before the app container
serves traffic. On a fresh DB this creates the schema; on an existing DB
it is a no-op for already-applied migrations.

**Gotcha:** Payload's CLI is not included in the Next.js standalone build
shipped in the production image, so `docker compose run --rm siab-payload
pnpm payload migrate` cannot execute against the prod image directly.
Instead, run `pnpm payload migrate` from a source checkout (locally or in
an ephemeral node container on the VPS), pointed at the production DB.

```bash
# 1. Read .env values, stripping any stray quotes.
read_env() {
  grep "^$1=" /srv/saas/infra/stacks/siab-payload/.env \
    | cut -d= -f2- \
    | sed -e "s/^['\"]//;s/['\"]\$//"
}
POSTGRES_PASSWORD=$(read_env POSTGRES_PASSWORD)
PAYLOAD_SECRET_VAL=$(read_env PAYLOAD_SECRET)

# 2. Clone (or update) the repo source somewhere ephemeral.
cd /tmp
git clone --depth=1 https://<USER>:<TOKEN>@github.com/Optidigi/siab-payload.git siab-source-tmp
cd siab-source-tmp

# 3. Run migrations from a node container on the compose internal network.
#    Compose names the network <project>_internal — the project name defaults
#    to the directory name (`siab-payload`), so the network is
#    `siab-payload_internal`.
docker run --rm \
  -v /tmp/siab-source-tmp:/app \
  -w /app \
  --network siab-payload_internal \
  -e DATABASE_URI="postgres://payload:${POSTGRES_PASSWORD}@postgres:5432/payload" \
  -e PAYLOAD_SECRET="${PAYLOAD_SECRET_VAL}" \
  -e DATA_DIR=/data-out \
  -e NEXT_PUBLIC_SUPER_ADMIN_DOMAIN=siteinabox.nl \
  node:22-alpine sh -c "
    corepack enable pnpm
    pnpm install --frozen-lockfile --silent
    pnpm payload generate:types
    pnpm payload migrate
  "

# 4. Verify tables exist.
docker exec siab-payload-postgres psql -U payload -d payload -c "\dt" | head

# 5. Clean up (the node container leaves root-owned files behind).
sudo rm -rf /tmp/siab-source-tmp

# 6. Restart the app container so it reconnects to the now-populated schema.
docker compose -f /srv/saas/infra/stacks/siab-payload/docker-compose.yml restart siab-payload
```

Future schema changes flow:

1. Edit collection config in `src/`.
2. `pnpm payload migrate:create <name>` (locally, against any throwaway
   Postgres — the CLI just diffs config vs the DB to emit SQL).
3. Commit the new file in `src/migrations/`.
4. Deploy the new image.
5. Re-run the migrate command above against the production DB.

## Step 6 — NPM proxy host

In the nginx-proxy-manager UI:

- **Domain Names:** `admin.<your-domain>` (e.g. `admin.siteinabox.nl`)
- **Scheme:** `http`
- **Forward Hostname / IP:** `siab-payload`
- **Forward Port:** `3000`
- **Block Common Exploits:** on
- **WebSockets Support:** on
- **SSL tab:** Request a new Let's Encrypt cert, **Force SSL** on, **HTTP/2** on

DNS for `admin.<your-domain>` must already resolve to the VPS or LE issuance
will fail.

## Step 7 — Verify health

```bash
curl https://admin.<your-domain>/api/health
# Expected: {"status":"ok","db":"connected","dataDir":"writable"}
```

If `dataDir` reports `unwritable`, see Gotcha 2. The current Dockerfile creates
the in-container `app` user with UID 1000 to match the host `serveradmin`
user; if you're deploying as a different host user, you must override.

## Step 8 — Seed first super-admin

The `Users` collection has a bootstrap exception that allows unauthenticated
user creation when the table is empty. Use it once, then change the password
immediately.

```bash
PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-22)
echo "Save this password: $PASSWORD"

curl -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@<your-domain>\",\"password\":\"$PASSWORD\",\"name\":\"Admin\",\"role\":\"super-admin\"}" \
  https://admin.<your-domain>/api/users
```

Log in at `https://admin.<your-domain>/login`, then go to your user record in
the admin UI and rotate the password.

## Step 9 — Create the orchestrator service user

The `sitegen-cms-orchestrator` integration calls Payload via API key. Create a
dedicated super-admin service user with `enableAPIKey: true`.

Easiest path: log in as the super-admin from Step 8, open the Users list, and
use the "Create User" form (Phase A3 added a global create form on `/users`).
Set role `super-admin`, tick "Enable API Key", and save the generated key.

Or via curl:

```bash
KEY=$(node -e "console.log(crypto.randomUUID())")

TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@<your-domain>","password":"<your-password>"}' \
  https://admin.<your-domain>/api/users/login \
  | python -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -X POST -H "Content-Type: application/json" -H "Authorization: JWT $TOKEN" \
  -d "{\"email\":\"orchestrator@<your-domain>\",\"name\":\"Orchestrator\",\"password\":\"$(openssl rand -hex 16)\",\"role\":\"super-admin\",\"enableAPIKey\":true,\"apiKey\":\"$KEY\"}" \
  https://admin.<your-domain>/api/users

echo "Save this API key: $KEY"
```

In `sitegen-cms-orchestrator/.env`:

```
PAYLOAD_API_URL=https://admin.<your-domain>
PAYLOAD_API_TOKEN=<key>
```

## Common gotchas

### Issue: `relation "users" does not exist` at boot

**Cause:** Postgres database is empty — schema migrations have not been run.
The production image does not run migrations on boot (Payload's CLI is not
bundled in the Next.js standalone build).

**Fix:** Run `pnpm payload migrate` from a source checkout against the
production DB as in Step 5, then restart the app container.

### Issue: `/api/health` returns `dataDir: unwritable`

**Cause:** UID mismatch between the host directory's owner and the in-container
`app` user. The Dockerfile bakes UID 1000.

**Fix:** Either chown the host data dir to UID 1000:

```bash
sudo chown -R 1000:1000 /srv/data/saas/siab-payload
```

…or pin the container's UID to whatever owns the host dir by adding to
`docker-compose.yml` under the `siab-payload` service:

```yaml
    user: "<uid>:<gid>"
```

### Issue: `Connection refused` to `localhost:3000` from inside the container

**Cause:** Next.js standalone output binds to the container hostname (the
container's own ID-derived hostname) by default, not `0.0.0.0`. Anything
hitting `localhost:3000` inside the container — including the healthcheck
script if you customise it — fails.

**Fix:** Set `HOSTNAME=0.0.0.0` in the stack's `.env`. The `docker-compose.yml`
already passes through `HOSTNAME` via the env-file.

### Issue: GHA push to GHCR returns `permission_denied: write_package`

**Cause:** A pre-existing GHCR package (`siab-payload`) was created under a
different repo or owner and isn't linked to the repo running the workflow.
GHA's auto-issued `GITHUB_TOKEN` only has write access to packages explicitly
linked to the calling repo.

**Fix:** Either:

- Delete the existing package on GHCR and let the workflow re-create it on the
  next push (it will be auto-linked to the calling repo), or
- On the package's GHCR page, **Package settings → Manage Actions access →
  Add Repository**, pick the repo, set role to **Write**.

### Issue: Build fails with `Module not found: @/payload-types` or `./admin/importMap.js`

**Cause:** Both files are gitignored — Payload generates them. A clean clone
will not contain them, so `pnpm build` fails before Next.js's compile step.

**Fix:** The Dockerfile must run

```
pnpm payload generate:types
pnpm payload generate:importmap
```

before `pnpm build`. If you're building locally for debugging, run those two
commands by hand first.

### Issue: TypeScript spread inference loses required fields under `next build`

**Cause:** `next build`'s type-checker is stricter than `tsc --noEmit` in some
spread-inference cases, particularly with React component props. Code that
typechecks locally with `tsc` fails the production build.

**Fix:** Avoid `<Component {...obj} />` for components whose prop type demands
specific keys. Pass props explicitly:

```tsx
// Bad — may fail under next build
<Foo {...derived} />

// Good
<Foo a={derived.a} b={derived.b} c={derived.c} />
```

### Issue: `.env` values with single or double quotes confuse shell scripts

**Cause:** Docker Compose's dotenv parser strips surrounding quotes from values
on read, but raw shell tools (`cut`, `awk` without explicit handling) do not.
A `.env` file written as `POSTGRES_PASSWORD='abc123'` produces `abc123` for
Compose but `'abc123'` for a `cut -d=` based reader, and the resulting
Postgres URI silently fails to authenticate.

**Fix:** Either store every value unquoted, or strip quotes on read:

```bash
read_env() {
  grep "^$1=" /srv/saas/infra/stacks/siab-payload/.env \
    | cut -d= -f2- \
    | sed -e "s/^['\"]//;s/['\"]\$//"
}
```

## Future improvements (out of scope for this runbook)

- **Migrations on boot.** The production image strips Payload's CLI as part
  of Next's standalone output, so we can't run `payload migrate` from the
  app container directly. Either ship a separate "tools" image stage that
  retains node_modules + the CLI and runs as an init container, or invoke
  the migration step from the deploy pipeline against a sidecar.
- **Secrets manager.** Move `RESEND_API_KEY` (and eventually
  `POSTGRES_PASSWORD`, `PAYLOAD_SECRET`) out of `.env` into a secrets
  manager — Doppler, Vault, or a SOPS-encrypted file at minimum.
- **CORS / CSRF allowlist.** Once `sitegen-cms-orchestrator` calls Payload
  cross-origin (it doesn't yet — currently same-VPS service-to-service),
  add the orchestrator's hostname to `cors` and `csrf` arrays in
  `payload.config.ts`.
- **`outputFileTracingRoot`.** Set this in `next.config.mjs` to silence the
  multiple-lockfile warning during local dev when this repo is checked out
  alongside sibling repos that also have lockfiles.

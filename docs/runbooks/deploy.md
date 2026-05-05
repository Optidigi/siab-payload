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

Migrations apply automatically on container start. The image's entrypoint
(`scripts/docker-entrypoint.sh`) runs `node scripts/migrate-on-boot.mjs`
before handing off to `node server.js`; `migrate-on-boot.mjs` calls
`payload.db.migrate()` against the running Postgres, which is a no-op when
no new migration files are present and applies them in order otherwise.

What this means in practice:

- **Fresh DB:** the first `docker compose up -d` creates the schema. Watch
  `docker logs siab-payload` to see `[migrate-on-boot] N migration(s) applied`.
- **Existing DB:** subsequent boots log `[migrate-on-boot] no pending
  migrations` (sub-second) and proceed to `node server.js`.
- **Migration failure:** the script exits non-zero, the container restarts
  per `restart: unless-stopped`, and the loop is visible in
  `docker compose ps`. Inspect `docker logs siab-payload` for the SQL error.

Future schema changes flow:

1. Edit collection config in `src/`.
2. `pnpm payload migrate:create <name>` (locally, against any throwaway
   Postgres — the CLI just diffs config vs the DB to emit SQL).
3. Commit the new file in `src/migrations/`.
4. Deploy the new image. `docker compose up -d` applies it on container
   start; no manual migrate step.

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

**Cause:** Migrations failed to apply at container start. The entrypoint
runs `migrate-on-boot.mjs` before `node server.js`, but if Postgres wasn't
healthy yet (or migrate hit a SQL error) the schema isn't there.

**Fix:** Inspect `docker logs siab-payload` for the `[migrate-on-boot]`
lines. If the issue was transient (Postgres slow to come up), `docker
compose restart siab-payload` re-runs migrate. If the SQL itself is the
problem, fix the offending migration file, rebuild and redeploy.

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

- **Secrets manager.** Move `RESEND_API_KEY` (and eventually
  `POSTGRES_PASSWORD`, `PAYLOAD_SECRET`) out of `.env` into a secrets
  manager — Doppler, Vault, or a SOPS-encrypted file at minimum.
- **CORS / CSRF allowlist.** Once `sitegen-cms-orchestrator` calls Payload
  cross-origin (it doesn't yet — currently same-VPS service-to-service),
  add the orchestrator's hostname to `cors` and `csrf` arrays in
  `payload.config.ts`.

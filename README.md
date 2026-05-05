# siab-payload

Multi-tenant Payload v3 + custom shadcn admin powering the siteinabox ecosystem.

See [the design spec](docs/superpowers/specs/2026-05-05-siab-payload-design.md) and [implementation plan](docs/superpowers/plans/2026-05-05-siab-payload-implementation.md).

## Local development

The dev Postgres lives on the production VPS as `siab-payload-postgres-dev` (port 5433 on the VPS). Local development connects via an SSH tunnel.

### One-time setup

```bash
pnpm install --ignore-workspace
cp .env.example .env
# edit .env: set PAYLOAD_SECRET (run `openssl rand -hex 32`)
```

### Each session

```bash
# Open the tunnel (background, exits when you log out)
ssh -L 5432:localhost:5433 -N -f prod

# Verify (optional)
psql -h localhost -U payload -d payload -c "SELECT 1"   # if psql installed locally

# Run the app
pnpm dev
```

### Closing the tunnel

```bash
# Find and kill the tunnel process
pkill -f "ssh -L 5432"
# or on Windows (Git Bash):  taskkill //F //PID <pid>   (find with `ps -ef | grep "ssh -L"`)
```

### Troubleshooting

- **`bind: Address already in use` when opening the tunnel** — an old tunnel is still bound to local port 5432. Run the closing command above, then reopen.
- **`pnpm dev` connects but reads stale data** — multiple repos / sessions share the same dev DB (it's one Postgres on the VPS). Intentional, but worth knowing if a colleague's seed data shows up unexpectedly.

### Why no local Postgres?

We don't run Docker on the developer machine. The dev DB lives on the VPS at `~/siab-payload-dev/` (separate from the production stack — different container name, different port, different volume). The compose file is `docker-compose.local.yml` in this repo, deployed to the VPS as `~/siab-payload-dev/docker-compose.yml`.

> Note: the original plan called for `/srv/saas/siab-payload-dev/`, but `/srv/saas/` is owned by root and the deploy user does not have passwordless sudo. The home-directory path works equally well for a dev DB and avoids needing root.

To redeploy after editing the compose file:
```bash
scp docker-compose.local.yml prod:~/siab-payload-dev/docker-compose.yml
ssh prod 'cd ~/siab-payload-dev && docker compose up -d'
```

## Hosts file (for multi-host testing later)

Phase 14 introduces tenant subdomains. Add to `C:\Windows\System32\drivers\etc\hosts` (Windows, run editor as admin) or `/etc/hosts`:

```
127.0.0.1 admin.localhost
127.0.0.1 admin.t1.test
127.0.0.1 admin.t2.test
```

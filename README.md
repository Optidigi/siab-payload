# siab-payload

Multi-tenant Payload v3 + custom shadcn admin powering the siteinabox ecosystem.

See [the design spec](docs/superpowers/specs/2026-05-05-siab-payload-design.md) and [implementation plan](docs/superpowers/plans/2026-05-05-siab-payload-implementation.md).

## Local development

See [docs/runbooks/local-dev.md](docs/runbooks/local-dev.md) for the full local setup (Docker Compose-based dev DB; cross-platform).

Quick start:

```bash
git clone https://github.com/Optidigi/siab-payload.git
cd siab-payload
pnpm install
docker compose -f docker-compose.local.yml up -d
cp .env.example .env   # edit PAYLOAD_SECRET
pnpm dev
```

Visit http://localhost:3000/admin to create the first user.

## Hosts file (for multi-host testing later)

Phase 14 introduces tenant subdomains. Add to `C:\Windows\System32\drivers\etc\hosts` (Windows, run editor as admin) or `/etc/hosts`:

```
127.0.0.1 admin.localhost
127.0.0.1 admin.t1.test
127.0.0.1 admin.t2.test
```

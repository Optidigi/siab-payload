# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                          # Next.js dev server (http://localhost:3000)
pnpm build                        # production build
pnpm typecheck                    # tsc --noEmit (requires generated types — see below)
pnpm test                         # vitest unit tests
pnpm test tests/unit/foo.test.ts  # run a single test file
pnpm test:e2e                     # Playwright E2E (requires dev server + `pnpm dlx playwright install chromium`)

pnpm payload generate:types       # regenerate src/payload-types.ts after collection edits
pnpm payload generate:importmap   # regenerate src/app/(payload)/admin/importMap.js
pnpm payload migrate              # apply pending migrations against local DB
pnpm payload migrate:create <name> # create a new migration after collection schema changes

pnpm registry:check               # re-pull @siab registry components and assert no git diff
```

**Generated files** — `src/payload-types.ts` and `src/app/(payload)/admin/importMap.js` are gitignored. Run `pnpm payload generate:types && pnpm payload generate:importmap` after any collection change, and always before `pnpm typecheck`. Both commands only walk the config — no live DB connection required.

**Local DB:** `docker compose -f docker-compose.local.yml up -d` — see `docs/runbooks/local-dev.md` for full setup.

## Architecture

### Multi-tenant + host-based routing

The app serves two domains from a single Next.js instance:

- `admin.<NEXT_PUBLIC_SUPER_ADMIN_DOMAIN>` → super-admin mode (manages all tenants)
- `admin.<tenant.domain>` → tenant mode (scoped to that tenant)

`src/middleware.ts` reads the `Host` header and stamps `x-siab-mode` (`"super-admin"` | `"tenant"`) and `x-siab-host` onto every request. All server components read these via `getSiabContext()` (`src/lib/context.ts`), which also resolves the tenant record from DB. Every protected page starts with `requireAuth()` (`src/lib/authGate.ts`), which calls `getSiabContext()` and runs the host × role × tenant access matrix via the pure `evaluateGate()` function (`src/lib/gateDecision.ts`) — this separation lets the matrix be unit-tested without booting Payload.

### Route groups

```
src/app/
  (frontend)/          # custom admin UI (shadcn-based)
    (admin)/           # all authenticated pages — layout.tsx calls requireAuth()
    login/             # unauthenticated
    forgot-password/
    reset-password/
  (payload)/           # Payload's native admin (disabled in payload.config.ts) + REST/GraphQL API routes
```

`@/*` resolves to `src/*` (tsconfig paths).

### Payload collections

Defined in `src/collections/`: `Tenants`, `Users`, `Media`, `Pages`, `SiteSettings`, `Forms`, `BlockPresets`. All tenant-scoped collections are registered with `multiTenantPlugin` in `src/payload.config.ts`. The plugin's native `afterTenantDelete` is disabled — cascade deletion is handled at the DB level via a FK CASCADE migration (`20260505_202447_cascade_tenant_delete`).

**Users** carry a `tenants[]` array (plugin-native shape). The domain invariant: super-admins have zero tenants, all other roles have exactly one. This is enforced by a custom `validate` on the field. Roles: `super-admin` / `owner` / `editor` / `viewer`.

### Projection system (disk output)

After-change hooks on Pages, SiteSettings, and Media (`src/hooks/projectToDisk.ts`) write JSON snapshots to `DATA_DIR` (default `./.data-out/`). Structure:

```
.data-out/tenants/<tenantId>/
  pages/<slug>.json       # projected via pageToJson()
  site.json               # projected via settingsToJson()
  media/<filename>        # copy of the uploaded file
  manifest.json           # version-stamped index of all entries
```

`pageToJson` / `settingsToJson` (`src/lib/projection/`) strip Payload's internal `id` fields from array rows and flatten Media relationships. Concurrent writes are serialized via an in-process async mutex in `src/lib/projection/manifest.ts`.

### Block system

Page content is a `blocks[]` array. Block definitions live in `src/blocks/` (each exports a Payload `Block` config). `src/blocks/registry.ts` exports the `BLOCKS` array and `blockBySlug` map. The client-side editor (`src/components/editor/`) renders blocks with react-hook-form + dnd-kit for drag reorder. Adding a new block type: define in `src/blocks/`, register in `registry.ts`, add field renderers to `src/components/editor/FieldRenderer.tsx`.

### UI components

`src/components/ui/` contains shadcn components sourced from the `@siab` private registry. **Do not hand-edit these files** — they are owned by the registry and `pnpm registry:check` will flag any drift. Custom composites (confirm dialogs, data table, page header, etc.) live directly in `src/components/`.

### Security layer

`src/middleware.ts` applies security headers (CSP, HSTS, X-Frame-Options) and rate-limits anonymous POSTs to `/api/forms` and `/api/users/forgot-password`. Several `beforeOperation` hooks on the Users collection enforce access invariants that Payload doesn't gate by default (credential writes, API key writes, bogus-auth forgotPassword bypass). See the inline comments in `src/collections/Users.ts` — they document the exact audit findings and why each hook exists.

## Key invariants to preserve

- `Users.tenants` length: 0 for super-admin, exactly 1 for all other roles. The `validateTenants` function enforces this at Payload's field-validation layer.
- `multiTenantPlugin`'s `cleanupAfterTenantDelete: false` is intentional — do not re-enable it. The FK CASCADE handles the DB side; `removeTenantDir` in `src/hooks/tenantLifecycle.ts` handles the disk side.
- `payload.config.ts` has `admin: { disable: true }` — Payload's own admin UI is intentionally disabled. All admin UI is the custom `(frontend)/(admin)` Next.js app.
- Schema changes require a migration: `pnpm payload migrate:create <name>`. Never rely on `push: true` in production; that is Postgres-adapter dev behaviour only.

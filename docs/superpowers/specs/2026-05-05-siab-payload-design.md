# siab-payload — design spec

**Status:** approved (brainstorm phase) — implemented through Wave 3 (see [implementation plan](../plans/2026-05-05-siab-payload-implementation.md) for delivered-vs-pending status).
**Date:** 2026-05-05
**Owner:** Optidigi / siteinabox managers

> **Reconciliation note (Wave 4):** Several technical details below were superseded during Phases 0-18 + Track 1 + Waves 1-3. The most consequential changes:
> - **Users-tenant model.** What this spec calls `tenant` (singular relationship on Users) shipped as `tenants[]` (array of `{ tenant }` rows in a join table) — the plugin-native shape required by `@payloadcms/plugin-multi-tenant`. Domain invariant is unchanged: super-admin → empty array; other roles → exactly one entry.
> - **Tenant-delete cleanup.** The plugin's `cleanupAfterTenantDelete` is **disabled** (incompatible with our Users-array validator running inside the FK-cascade transaction). Cleanup happens via Postgres `ON DELETE CASCADE` instead — see Wave 2-3 in the implementation plan.
> - **Migrations.** Apply automatically on container boot (entrypoint runs `migrate-on-boot.bundled.mjs` before `node server.js`); operators no longer run a manual migrate step.
>
> Cross-references in this spec (`user.tenant`, `cleanupAfterTenantDelete: true`, manual migration) are kept for narrative continuity; the Wave-1/2/3 deltas are the source of truth for current behaviour.

## Purpose

Build the central Payload v3 CMS instance that powers the siteinabox ecosystem. It is the missing piece in the existing four-repo stack:

- `Optidigi/siab-site-orchestrator` — provisions new static landing-page repos
- `Optidigi/siab-payload-orchestrator` — converts a static site to SSR + connects it to this CMS
- `Optidigi/siab-site-template` — Astro 5 boilerplate cloned per site
- `Optidigi/siab-site-themes` — theme catalog

This repo (`deploy-siab-payload`) builds the image `ghcr.io/optidigi/siab-payload:latest`, which runs on the production VPS, serves the multi-tenant admin UI, and writes per-tenant JSON to disk for the SSR site containers to consume.

The admin UI is a **full reskin** of Payload's defaults — every list, form, and dashboard view is custom shadcn/ui, mirroring the visual language of [shadcn dashboard-01](https://ui.shadcn.com/blocks#dashboard-01). Payload runs in headless mode; only its API + auth + hooks are used.

## Decisions (Q&A summary)

| # | Question | Decision |
|---|---|---|
| 1 | shadcn scope | **D — full reskin.** Payload's admin (`/admin/*`) disabled. Every visible route is shadcn. |
| 2 | audience & topology | **A + caveat.** Single Next.js app, host-based tenant resolution. `admin.siteinabox.nl` → super-admin; `admin.<clientdomain>` → that tenant's editors only. |
| 3 | super-admin nav across tenants | **A.** In-app tenant switcher at `admin.siteinabox.nl/sites/<slug>/*`. Super-admin never logs into client subdomains. |
| 4 | tenant onboarding automation | **A** (manual). Orchestrator creates the tenant record only (step 2). DNS, NPM proxy host, TLS cert, owner-user creation/invite are manual. |
| 5 | content model | **B.** Pages, Media, SiteSettings (global per tenant), Forms, Tenants, Users. Reusable content (testimonials, FAQs, services) lives as inline blocks inside Pages. |
| 6 | roles & user-tenant model | **B.** Roles per tenant: `super-admin` / `owner` / `editor` / `viewer`. Each non-super-admin user belongs to exactly one tenant; super-admins belong to none. *(Shipped as `tenants[]` array — see Wave 1 reconciliation note above.)* |
| 7 | dashboard data | **A.** Editorial activity sourced from Payload itself (no external integrations in v1). |

## Approach (chosen: 1)

Single Next.js 15 app. Payload v3 runs as a backend module inside it (`config.admin.disable = true`); only its REST/GraphQL API, auth, and hooks are used. All visible routes are custom shadcn components. The official `@payloadcms/plugin-multi-tenant` handles automatic tenant scoping on every collection query.

Rejected alternatives:
- **Two apps (headless Payload + standalone shadcn frontend).** Doubles ops cost, adds CORS / auth-relay complexity, no concrete future benefit for a 1–2 person team.
- **Payload admin coexists at `/admin` as escape hatch.** Contradicts the full-reskin commitment; two parallel UIs cause editor confusion and subtle session bugs.

## Architecture

### Topology

```
Browser
  │  HTTPS
  ▼
nginx-proxy-manager (existing, on `proxy` network) — TLS termination, Let's Encrypt
  │
  ├─ admin.siteinabox.nl ──┐
  ├─ admin.clientasite.nl ─┤
  └─ admin.clientbsite.nl ─┤
                           ▼
                  siab-payload (Next.js 15, single container)
                  - shadcn UI at /
                  - Payload v3 (admin disabled)
                  - /api/* REST + /api/graphql
                  - Host-based tenant middleware
                  - Multi-tenant plugin
                  - JWT cookie per host
                           │              │
                           ▼              ▼
                  Postgres 17     /srv/data/saas/siab-payload/
                  (collections,     tenants/<id>/
                   users, content)    pages/  site.json  media/  manifest.json
                                              │
                                              ▼ RO mount as /data
                                  Astro SSR site container (per tenant)
                                  ghcr.io/optidigi/site-<slug>:latest
                                  reads /data on each request
```

### Stack

- **Runtime:** Next.js 15 (App Router) + Payload v3 as a backend module
- **DB:** Postgres 17-alpine via `@payloadcms/db-postgres`
- **Multi-tenancy:** `@payloadcms/plugin-multi-tenant` (official) — auto-scopes every query
- **UI:** shadcn/ui (Radix + Tailwind 4) — components copied from the registry; Recharts for the dashboard chart
- **Forms:** `react-hook-form` + `zod` (idiomatic shadcn pattern)
- **Email:** Resend (free tier, ~3K emails/month, more than sufficient)
- **Auth:** Payload built-in JWT, HTTP-only cookies scoped to host

## Data model

### Tenants (super-admin only)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | display name |
| `slug` | text, **unique** | super-admin URL segment (`/sites/<slug>/...`) |
| `domain` | text, **unique** | production domain (e.g. `clientasite.nl`); host-resolution lookup key |
| `status` | enum | `provisioning` / `active` / `suspended` / `archived` |
| `siteRepo` | text | e.g. `optidigi/site-clientasite` |
| `notes` | textarea | internal notes |

### Users (Payload auth collection)

| Field | Type | Notes |
|---|---|---|
| `email` | email | auth identity |
| `password` | hash | Payload built-in |
| `name` | text | |
| `role` | enum | `super-admin` / `owner` / `editor` / `viewer` |
| `tenants` | array of `{ tenant: relationship → Tenants }` | **empty** when role is `super-admin`, **exactly one entry** otherwise (custom array-level `validate` enforces). Multiple users may share a tenant — clients add team editors. *(Originally specced as a singular `tenant` relationship; reshaped to plugin-native `tenants[]` in Wave 1 — migration `20260505_194128_users_tenants_array`. The field is manually declared with `tenantsArrayField.includeDefaultField: false` so we can attach the validator.)* |
| `apiKey` | (Payload built-in) | enabled via `auth: { useAPIKey: true }`; the orchestrator uses one |

### Pages (auto-scoped by multi-tenant plugin)

| Field | Type | Notes |
|---|---|---|
| `tenant` | relationship → Tenants | added by plugin |
| `title` | text, required | |
| `slug` | text, required | unique per tenant |
| `status` | enum | `draft` / `published` |
| `blocks` | blocks | flexible page builder (block types below) |
| `seo` | group | `title`, `description`, `ogImage` (relationship → Media) |
| `updatedBy` | relationship → Users | tracked for activity feed |

**Block types (v1):** `Hero`, `FeatureList`, `Testimonials`, `FAQ`, `CTA`, `RichText`, `ContactSection`. New types are pure config — no UI changes (see Field renderer below).

### Media (auto-scoped)

| Field | Type | Notes |
|---|---|---|
| `tenant` | relationship → Tenants | added by plugin |
| `file` | upload | written to `<DATA_DIR>/tenants/<tenantId>/media/<filename>` |
| `alt` | text | |
| `caption` | text | |
| `filename`, `mimeType`, `size` | (auto) | |

### SiteSettings (auto-scoped, one record per tenant)

Implemented as a *collection with a unique `tenant` constraint*, not a Payload global (Payload globals don't natively support multi-tenancy).

| Field | Type | Notes |
|---|---|---|
| `tenant` | relationship → Tenants, **unique** | |
| `siteName`, `siteUrl`, `contactEmail` | text | |
| `branding` | group | `logo` (relationship → Media), `primaryColor` |
| `contact` | group | `phone`, `address`, `social` (array) |
| `navigation` | array | menu items: `label`, `href`, `external` (bool) |

### Forms (submissions inbox, auto-scoped)

| Field | Type | Notes |
|---|---|---|
| `tenant` | relationship → Tenants | added by plugin |
| `formName` | text | e.g. `"Contact form"` |
| `pageUrl` | text | submitting page |
| `data` | JSON | full submission payload |
| `email`, `name`, `message` | text/textarea | extracted top-level for fast list view |
| `status` | enum | `new` / `read` / `contacted` / `spam` |
| `ipAddress` | text | |

### Access control

The multi-tenant plugin auto-injects a tenant filter for non-super-admin users (using `user.tenants[].tenant`). Roles layer on top:

| Collection | super-admin | owner | editor | viewer |
|---|---|---|---|---|
| Tenants | CRUD | — | — | — |
| Users | CRUD all | CRUD within tenant | read self | read self |
| Pages | CRUD all | CRUD scoped | CRUD scoped | read scoped |
| Media | CRUD all | CRUD scoped | CRUD scoped | read scoped |
| SiteSettings | CRUD all | update scoped | read scoped | read scoped |
| Forms | CRUD all | read+update scoped | read+update scoped | read scoped |

The "owner manages users within their own tenant" rule is the only non-trivial access function — requires custom code allowing user CRUD only when `target.tenant === actor.tenant`.

## Routing & auth

### URL structure

**`admin.siteinabox.nl/*` — super-admin:**

```
/                              dashboard (cross-tenant editorial activity)
/sites                         tenants list
/sites/<slug>                  tenant overview (scoped dashboard)
/sites/<slug>/pages            pages list (scoped)
/sites/<slug>/pages/<id>       page editor
/sites/<slug>/media            media library
/sites/<slug>/forms            forms inbox
/sites/<slug>/settings         site settings
/sites/<slug>/users            manage editors for this tenant
/sites/<slug>/onboarding       6-step checklist (DNS / NPM / cert / invite / verify)
/users                         all users (cross-tenant)
/login                         login (super-admins only)
/api/*                         Payload REST + GraphQL
```

**`admin.<clientdomain>/*` — tenant editor:**

```
/                              dashboard (this tenant only)
/pages                         pages list
/pages/<id>                    page editor
/media                         media library
/forms                         forms inbox
/settings                      site settings (owner edits, others read)
/users                         team management (owner only)
/login                         login (tenant users only)
/forgot-password               password reset request
/reset-password/<token>        set new password
/api/*                         Payload (auto-scoped)
```

### Host-resolution middleware

Runs first on every request. Reads `Host` header, strips `admin.` prefix, resolves tenant.

```ts
const host = req.headers.host
const domain = host.replace(/^admin\./, "")

if (domain === process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN) {
  ctx.mode = "super-admin"
  ctx.tenant = null
} else {
  const tenant = await Tenants.findOne({ where: { domain: { equals: domain } } })
  if (!tenant) → 404 "site not provisioned"
  if (tenant.status === "suspended") → 503 "suspended"
  if (tenant.status === "archived")  → 410 "Gone"
  ctx.mode = "tenant"
  ctx.tenant = tenant
}
```

### Auth gate (after middleware)

```ts
if (!user) → redirect("/login")
if (ctx.mode === "super-admin" && user.role !== "super-admin") → 403 + clearCookie
if (ctx.mode === "tenant" && user.role === "super-admin") → 403 (super-admin doesn't log in here)
if (ctx.mode === "tenant" && user.tenants[0]?.tenant !== ctx.tenant.id) → 403 + clearCookie
```

### Login flow

1. Visit protected URL with no auth → redirect to `/login`
2. POST `/api/users/login` (Payload built-in) → cookie set scoped to current host
3. Auth gate validates `user.role` × `ctx.mode` × `user.tenants[0].tenant === ctx.tenant.id`
4. Mismatch → 403 + clear cookie

### Password reset / first-time invite

When the super-admin (or tenant owner) creates a user record without setting a password, Payload's `forgot-password` flow sends an email with a reset link. The link's host **must match where they'll log in** — the email template is overridden to compute the right host from the user's tenant domain (`user.tenants[0].tenant.domain`, resolved server-side) or falls back to `siteinabox.nl` for super-admins.

### Cookie scoping (security boundary)

Cookies are scoped to host. `admin.clientasite.nl` cookies are not sent to `admin.siteinabox.nl` or `admin.clientbsite.nl`. Implications:
- Stolen tenant editor cookie is unusable on super-admin host or other tenants
- Super-admin must log in separately at `admin.siteinabox.nl` (different cookie scope)

## UI structure

### Dashboard-01 mapping (super-admin view at `/`)

| dashboard-01 slot | siab-payload content |
|---|---|
| Sidebar | Dashboard / Sites / Users + Quick-access (Recent edits, New leads, Onboarding) + Settings |
| Topbar | Breadcrumb + date-range picker + theme toggle + user menu |
| Stat card 1 | Total tenants |
| Stat card 2 | Published pages |
| Stat card 3 | Edits this week |
| Stat card 4 | Form submissions this month |
| Area chart | Edits per day, last 30 days |
| Data table | Recent activity (joined `updatedAt`/`updatedBy` across Pages, Media, SiteSettings, Forms) |

Tenant-editor view at `admin.<clientdomain>/` — same components, scoped data. Sidebar drops "Sites." Owner sees an extra "Team" sidebar item.

### Key views beyond the dashboard

| Route | Components | Notes |
|---|---|---|
| `/sites` (super-admin) | `<DataTable>` + filters + bulk actions | Columns: name, domain, slug, status pill, page count, last activity |
| `/sites/<slug>` (super-admin) | scoped dashboard | Same dashboard shell, scoped data + super-admin-only actions (suspend, archive) |
| `/pages` | `<DataTable>` | Columns: title, slug, status, updatedAt, updatedBy. Bulk publish/unpublish. |
| `/pages/<id>` | **block editor** (custom — see below) | Most complex view |
| `/media` | grid of cards + uploader + detail `<Sheet>` | shadcn doesn't ship a media library; built on `<Card>` + `<Sheet>` |
| `/forms` | `<DataTable>` + detail `<Sheet>` | Filter by status; row click opens full submission |
| `/settings` | tabbed `<Form>` (General / Branding / Contact / Navigation) | Owner edits; others read |
| `/users` | `<DataTable>` + invite dialog | Owner: invite/remove within tenant. Super-admin: same via `/sites/<slug>/users`. |
| `/sites/<slug>/onboarding` (super-admin) | 6-step checklist with copy-pasteable values | DNS / NPM proxy host / cert / owner user / invite / verify |

### Block editor

`/pages/<id>` is the only view shadcn alone doesn't cover. Components needed:

- **Block list** — drag-to-reorder, expand/collapse, duplicate, delete
- **Add block picker** — modal with cards per block type (Hero, FeatureList, Testimonials, FAQ, CTA, RichText, ContactSection)
- **Per-block form** — generated from the block's Payload field schema
- **Right panel** — SEO group + page-level settings (slug, status, publish/unpublish)

The form generation uses a small **field renderer** keyed by Payload field types. Mapping (~12 types):

| Payload type | shadcn component |
|---|---|
| `text` | `<Input>` |
| `textarea` | `<Textarea>` |
| `richText` | `<Textarea>` v1 (the `RichText` block type uses this; upgrade to Tiptap-backed editor in v2 without UI changes elsewhere) |
| `number` | `<Input type="number">` |
| `checkbox` | `<Switch>` |
| `select` | `<Select>` |
| `relationship` (single) | `<Combobox>` |
| `relationship` (multiple) | `<Combobox multiple>` |
| `upload` | `<MediaPicker>` (custom, opens media library `<Sheet>`) |
| `array` | repeating field renderer + reorder |
| `group` | nested field group |
| `blocks` | recursive block list |
| `date` | `<DatePicker>` |

New block types are pure config — no UI changes needed. Adding a custom field type means adding one entry to the renderer map.

We are **not** using a generic JSON-schema form library (`react-jsonschema-form` etc.) — Payload's field config is similar but not identical to JSON Schema, and the translation layer would be more code than just rendering directly.

### Component inventory

shadcn registry components: `button`, `card`, `input`, `textarea`, `label`, `select`, `combobox`, `dialog`, `sheet`, `table`, `data-table` (block), `dropdown-menu`, `tabs`, `form`, `badge`, `avatar`, `breadcrumb`, `sidebar` (block), `chart` (block), `toast`, `skeleton`, `separator`, `switch`, `tooltip`, `date-picker`. ~25 components.

Custom components: `MediaPicker`, `BlockEditor`, `BlockListItem`, `BlockTypePicker`, `FieldRenderer`, `TenantSwitcher`, `RoleBadge`, `ActivityFeed`, `OnboardingChecklist`.

## Hooks & orchestrator integration

### afterChange — atomic JSON projection to disk

On `Pages`, `Media`, `SiteSettings`. For published docs, transform to flat JSON (resolve relationships to URLs, denormalize) and write atomically: write to `<file>.tmp` → fsync → rename. Update tenant's `manifest.json` with version stamp + entry list.

```
/srv/data/saas/siab-payload/
├── tenants/
│   └── <tenantId>/
│       ├── pages/
│       │   ├── home.json
│       │   ├── about.json
│       │   └── ...
│       ├── media/        ← uploaded files live here directly
│       │   ├── logo.png
│       │   └── ...
│       ├── site.json     ← SiteSettings projection
│       └── manifest.json ← version + entry index
└── archived/             ← moved here when tenant.status → archived
    └── <tenantId>/
```

**Properties:**
- **Atomic** — write `.tmp` → fsync → rename. SSR readers never see partial files.
- **Idempotent** — re-running `afterChange` produces the same on-disk state.
- **Retryable** — disk failure logs + queues retry. DB row is the source of truth; disk is a derived projection.

**Cleanup:**
- `afterDelete` on Pages/Media → remove file
- `afterChange` on Tenants (op=create) → mkdir tenant dir + initial empty manifest
- `afterChange` on Tenants (status → archived) → `rename tenants/<id>/ → archived/<id>/`
- `afterChange` on Tenants (status → suspended) → no disk change; auth gate blocks logins
- *(Wave 2-3 additions)* `afterChange` on Tenants (status: archived → non-archived) → `rename archived/<id>/ → tenants/<id>/` (restore)
- *(Wave 2-3 additions)* `afterDelete` on Tenants → `fs.rm` both `tenants/<id>/` and `archived/<id>/`; clear stale `payload-tenant` cookie if a super-admin deleted the tenant they were scoped into
- *(Wave 2-3 additions)* DB-side: `pages/media/site_settings/forms/users_tenants.tenant_id` use `ON DELETE CASCADE` (migration `20260505_202447_cascade_tenant_delete`). Tenant delete atomically removes all owned content; the down direction is intentionally non-reversible.
- The plugin's built-in `cleanupAfterTenantDelete` is **disabled** (`false`). It runs cleanup writes from inside the tenant-delete transaction, which collides with our Users `tenants[]` validator (it counts the deleted tenant as still attached). FK CASCADE replaces it.

### Failure model

If DB write succeeds but disk fails, page is "published in DB but not on disk." UI shows warning toast. Backoff worker retries (Payload's built-in jobs queue, Postgres-backed). After N retries the tenant gets a "publish blocked" badge in the dashboard. **Not** doing two-phase commit — too much code for a rare failure; stale-with-warning is the right tradeoff.

### Orchestrator API

The `cms-orchestrator` agent calls `POST /api/tenants` with a Payload API key:

```
POST /api/tenants
Authorization: users API-Key <PAYLOAD_API_TOKEN>
Content-Type: application/json

{ "name": "Client A", "slug": "clientasite",
  "domain": "clientasite.nl", "siteRepo": "optidigi/site-clientasite",
  "status": "provisioning" }

→ 201 { "id": "ten_abc123", ... }
```

The token is a Payload-issued API key tied to a service `Users` record (`role: super-admin`, `name: 'orchestrator'`, no password — API-only, `auth: { useAPIKey: true }`). Stored in the orchestrator's `.env` as `PAYLOAD_API_TOKEN`.

The endpoint is just Payload's auto-generated REST endpoint — no custom code beyond the `afterChange` that creates the data directory.

**Same key, all collections.** The `payload-seeder` subagent uses the same API key to `POST /api/pages`, `POST /api/media`, and `POST /api/site-settings` during Phase 4 of the cms-orchestrator runbook. Because the service user is `role: super-admin`, the multi-tenant plugin does **not** auto-scope its writes — the seeder must explicitly include `tenant: <id>` in every request body. Failing to include it raises a validation error (the `tenant` field is required on auto-scoped collections), so accidental tenant-less writes are impossible.

## Deployment

### Compose

```yaml
services:
  siab-payload:
    image: ghcr.io/optidigi/siab-payload:latest
    container_name: siab-payload
    restart: unless-stopped
    environment:
      DATABASE_URI: postgres://payload:${POSTGRES_PASSWORD}@postgres:5432/payload
      PAYLOAD_SECRET: ${PAYLOAD_SECRET}
      DATA_DIR: /data-out
      NEXT_PUBLIC_SUPER_ADMIN_DOMAIN: siteinabox.nl
      RESEND_API_KEY: ${RESEND_API_KEY}
      EMAIL_FROM: noreply@siteinabox.nl
      NODE_ENV: production
    volumes:
      - /srv/data/saas/siab-payload:/data-out
    networks: [proxy, internal]
    depends_on:
      postgres: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      start_period: 60s

  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: payload
      POSTGRES_USER: payload
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: [postgres-data:/var/lib/postgresql/data]
    networks: [internal]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U payload"]
      interval: 10s

volumes:
  postgres-data:

networks:
  proxy:    { external: true }   # existing — NPM lives here
  internal:                      # private — payload ↔ postgres only
```

### Mount strategy

| Container | Host path | Container path | Mode |
|---|---|---|---|
| `siab-payload` | `/srv/data/saas/siab-payload/` | `/data-out/` | RW (sees all tenants) |
| `site-<slug>` (per tenant) | `/srv/data/saas/siab-payload/tenants/<id>/` | `/data/` | **RO** (sees only its tenant) |

Kernel-level isolation — a compromised SSR site container cannot read other tenants' data.

### Image build

Multi-stage Dockerfile (`deps` → `builder` → `runner`, node:22-alpine throughout). GitHub Actions on push to `main` builds and pushes to `ghcr.io/optidigi/siab-payload:latest` and `:sha-<commit>`. Production updates via manual `docker compose pull && docker compose up -d` (consistent with existing siteinabox image-pull discipline; Renovate handles dependency PRs upstream).

*(Wave 2-3)* The image's entrypoint (`scripts/docker-entrypoint.sh`) runs `migrate-on-boot.bundled.mjs` — an esbuild-bundled, self-contained `.mjs` produced from `scripts/migrate-on-boot-entry.ts` — **before** `node server.js`. Migrations apply automatically on container boot (no-op when nothing pending). The bundle lives in `dist-runtime/` (gitignored, dockerignored — built inside the Docker image only).

### Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URI` | Postgres connection |
| `PAYLOAD_SECRET` | JWT HMAC secret (must persist) |
| `DATA_DIR` | On-disk JSON output (`/data-out`) |
| `NEXT_PUBLIC_SUPER_ADMIN_DOMAIN` | `siteinabox.nl` |
| `RESEND_API_KEY` | Email transport |
| `EMAIL_FROM` | `noreply@siteinabox.nl` |
| `POSTGRES_PASSWORD` | DB password (compose-only) |

### NPM proxy host config (manual, per onboarding)

For each new tenant the super-admin pastes into NPM:

```
Domain:                admin.<clientdomain>
Forward Hostname:      siab-payload
Forward Port:          3000
Block Common Exploits: on
WebSockets Support:    on
SSL: Let's Encrypt → Force SSL → HTTP/2 Support: on
```

The super-admin onboarding view at `/sites/<slug>/onboarding` exposes a "Copy NPM config JSON" button.

### Health check

`GET /api/health` returns `200 { status, db, dataDir }` if Postgres is reachable and `DATA_DIR` is writable. Compose health check pings it; existing **uptime-kuma** can ping it for liveness alerts.

### Email

Resend free tier (3K/month, 100/day) — sufficient for invites + password resets indefinitely at expected volume.

### What's NOT in v1

- Watchtower (manual `docker compose pull`)
- Sharp / image variants (originals only)
- Redis / external queue (Payload v3's Postgres-backed job queue is enough)
- Audit log collection (recent activity is computed from `updatedAt`/`updatedBy`)
- Posts/Blog, Testimonials/Services/FAQs as collections (inline blocks instead)
- DNS-provider automation (manual)

## Error handling

### Middleware-level

- Unknown host → 404 "site not provisioned"
- `status: suspended` → 503 "temporarily unavailable" + admin@optidigi.nl mailto
- `status: archived` → 410 Gone
- DB unreachable → 503 generic (no leaks)

### Auth-level

- Wrong-host cookie → 403 + clear cookie + redirect to `/login`
- Expired JWT → redirect to `/login?next=<path>`
- Wrong credentials → stay on `/login` with generic field error (no enumeration)

### App-level

- `app/error.tsx` for route errors; `app/not-found.tsx` for 404s
- Global error boundary for unhandled React errors
- API errors return `{ error, code }` JSON — no stack traces ever

### Disk write failures

Retry queue + warning toast + "publish blocked" badge on the tenant's dashboard card. See "Failure model" above.

### Logging

Structured logs via **pino** (JSON to stdout). Levels: `info` (publishes, logins), `warn` (retries, slow queries), `error` (user-visible failures). No external observability in v1.

## Testing

### Critical (cannot ship without)

1. **Tenant isolation.** For every collection × every endpoint, verify a user from tenant A cannot read, write, or count tenant B's data. ~30 tests, parameterized. P0 risk if it leaks.
2. **Auth gate matrix.** Every combination of `(host, user.role, user.tenants[0]?.tenant)` evaluated. ~16 cases, table-driven.
3. **afterChange JSON projection.** Snapshot tests: given a Page doc with each block type, the on-disk JSON matches expected shape. ~10 tests.

### Standard

- Unit: field renderers, schema transformations (Vitest)
- Integration: hooks against real Postgres (testcontainers, Vitest)
- E2E: ~5 critical Playwright flows
  - super-admin login + dashboard loads
  - super-admin creates a tenant; data dir appears on disk
  - super-admin "view as" tenant; create + publish a page; JSON file appears
  - tenant editor login at `admin.<theirdomain>`; edit page; sees changes
  - role gate: viewer attempts to publish → 403

### Explicitly not testing

- Payload's own internals (upstream coverage)
- shadcn components (copy-pasted, no logic)
- NPM / DNS / Let's Encrypt (out of scope)

## Open questions / future work

- **Image variants** (Sharp + responsive sizes) — defer to v2
- **Audit log collection** — defer until first real "who changed this?" incident
- **DNS-provider automation** — defer until volume justifies it
- **Tiptap rich text** — start with textarea; upgrade when first complaint
- **Tenant impersonation / "view as editor"** — useful for super-admin debugging but not required for v1

## References

- shadcn dashboard-01: https://ui.shadcn.com/blocks#dashboard-01
- Payload v3 docs: https://payloadcms.com/docs
- Multi-tenant plugin: https://payloadcms.com/docs/plugins/multi-tenant
- Sibling repos:
  - https://github.com/Optidigi/siab-site-orchestrator
  - https://github.com/Optidigi/siab-payload-orchestrator
  - https://github.com/Optidigi/siab-site-template
  - https://github.com/Optidigi/siab-site-themes

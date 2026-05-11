# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev                                    # start dev server (http://localhost:3000)
docker compose -f docker-compose.local.yml up -d  # start local Postgres (required first)

# Type generation — run after any collection field change
pnpm payload generate:types
pnpm payload generate:importmap

# Type check + lint
pnpm typecheck
pnpm lint

# Migrations
pnpm payload migrate:create <name>          # create migration after collection edits
pnpm payload migrate                        # apply pending migrations

# Tests
pnpm test                                   # unit tests only (no DB required)
pnpm test tests/unit/foo.test.ts            # single test file
pnpm test tests/integration/               # integration tests (real DB required — compose must be up)
pnpm test:e2e                               # Playwright E2E (dev server must be running)

# Registry drift check (CI gate — validates @siab/* components match the registry)
pnpm registry:check
```

CI runs typecheck and registry drift only — it does not run the test suite. Run tests locally before pushing.

## Architecture

### Stack
Next.js 15 App Router + PayloadCMS v3 (3.84.x) + PostgreSQL. React 19, TypeScript, Tailwind, shadcn/ui sourced from the `@siab/*` private registry. pnpm 10, Node 22.

### Multi-tenant routing
Tenancy is resolved from the HTTP `Host` header in `src/middleware.ts`. The middleware stamps two headers onto every matched request:
- `x-siab-mode`: `"super-admin"` | `"tenant"`
- `x-siab-host`: the bare domain (strip `admin.` prefix)

These headers are consumed by `getSiabContext()` (`src/lib/context.ts`), which resolves the `SiabContext` type:

```ts
type SiabContext =
  | { mode: "super-admin"; tenant: null }
  | { mode: "tenant"; tenant: Tenant }
```

In dev, `admin.localhost` is treated as the super-admin host. For tenant testing add `admin.t1.test` to `/etc/hosts`.

### Role model
Four roles with hard invariants enforced in `src/collections/Users.ts` and `src/lib/gateDecision.ts`:

| Role | Tenants |
|------|---------|
| `super-admin` | zero (validated) |
| `owner` | exactly one |
| `editor` | exactly one |
| `viewer` | exactly one |

A user may never have more or fewer tenants than their role requires. This is enforced by `validateTenants` (field-level) and `evaluateGate` (request-level).

### Auth patterns

**RSC pages** — always call `requireAuth()` or `requireRole()` from `@/lib/authGate`:
```ts
const { user, ctx } = await requireAuth()
const { user, ctx } = await requireRole(["super-admin", "owner"])
```

**Server actions** (`"use server"` files) — Next.js provides no built-in auth for server actions. Every action must resolve the caller explicitly:
```ts
const { user: caller } = await payload.auth({ headers: await headers() })
if (!caller) throw new Error("Forbidden: authentication required")
```
See `src/lib/actions/inviteUser.ts` for the reference implementation.

**Payload Local API** — use `user: caller` (not `overrideAccess: true`) for user-triggered operations so collection and field-level access rules apply. Reserve `overrideAccess: true` for system-internal operations (jobs, lifecycle hooks).

### Collections
Defined in `src/collections/`. All tenant-scoped data collections (`pages`, `media`, `site-settings`, `forms`, `block-presets`) are registered with `@payloadcms/plugin-multi-tenant`. `Tenants` and `Users` are super-admin-managed.

After any field or collection change: run `pnpm payload generate:types` and create a migration with `pnpm payload migrate:create <name>`.

### Access control
`src/access/` contains shared access functions used across collections:
- `isSuperAdmin` / `isSuperAdminField` — collection/field-level super-admin gates
- `canManageUsers` — combined owner/super-admin read+update gate for Users
- `isOwnerInTenant`, `isTenantMember` — tenant-scoped gates
- `authSignals` — detects auth headers without validating them (used for the forgot-password rate-limit bypass guard)

**Security hook order**: `beforeOperation` fires before any field-level access strip, making it the correct place for auth-level guards that need to see the original request data. `beforeValidate` (collection-level) runs after field strips. `beforeChange` runs after that.

### Data queries
`src/lib/queries/` contains typed query functions for each collection. Server components should use these rather than calling `payload.find()` directly. `src/lib/api.ts` contains `parsePayloadError()` for extracting structured errors from Payload REST responses in client-side forms.

### Projection and disk output
`src/lib/projection/` serialises Pages and SiteSettings documents to JSON files on disk (`DATA_DIR` env). Tenant lifecycle hooks in `src/hooks/tenantLifecycle.ts` manage per-tenant directories on create/archive/restore/delete.

### UI components and design system

The frontend is built on a **two-layer component model**:

**Layer 1 — Registry primitives** (`src/components/ui/`)
Sourced from the `@siab/*` private shadcn registry. These files are fully registry-owned: do not hand-edit them. When the registry ships an update, running `pnpm registry:check` (or `pnpm dlx shadcn@latest add @siab/<component> --overwrite`) pulls the new version in and the whole frontend seamlessly inherits the new design. Any manual edit is immediately visible as a diff and blocked by CI.

**Layer 2 — Composite components** (`src/components/`)
Application-level components built by composing Layer 1 primitives: `data-table.tsx`, `page-header.tsx`, `confirm-dialog.tsx`, `typed-confirm-dialog.tsx`, `empty-state.tsx`, and subdirectories (`dashboard/`, `forms/`, `layout/`, etc.). These can be edited freely.

**Design token system** (`src/styles/globals.css`)
All colours, radii, and semantic slots are CSS custom properties using oklch:
`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--destructive`, `--success`, `--warning`, sidebar tokens, chart tokens, etc. Dark mode is handled via the `.dark` class with its own token overrides. Theming flows entirely through these tokens — never use hard-coded colours or override registry component internals.

**Rules for any new UI work:**
- Build exclusively from Layer 1 primitives. Only reach outside them when a primitive genuinely cannot express the requirement.
- All colour and spacing must reference token classes (`bg-background`, `text-muted-foreground`, `border-border`, etc.) — not arbitrary Tailwind values or hex codes.
- Do not wrap or re-implement a primitive that already exists in `src/components/ui/`. Compose instead.
- Do not add inline `style` props to override token values — that breaks registry update propagation.

### Testing
- **Unit tests** (`tests/unit/`): Vitest, `environment: "node"`, no DB. `server-only` is stubbed via the alias in `vitest.config.ts`. Fast; suitable for access functions, pure logic, hook logic.
- **Integration tests** (`tests/integration/`): real Postgres, DB name `payload_test`. Sequential (single fork — see `vitest.config.ts`). Do not mock the database in integration tests; prior incidents showed mock/prod divergence masks real failures.
- **E2E tests** (`tests/e2e/`): Playwright, requires a running dev server.

Test setup reads `.env` and overrides `DATABASE_URI` to `payload_test` automatically (`tests/setup.ts`).

## Backlogs

`docs/backlog/` is the canonical source of truth for all open, deferred, and closed work items. It must stay in sync with the codebase at all times.

- **`docs/backlog/backend/README.md`** — security findings, data-layer issues, operational observations, CI/infra items. IDs: `OBS-N` (current high water mark: OBS-26).
- **`docs/backlog/frontend/README.md`** — UI/UX items, client-side bugs, design regressions. IDs: `FE-N` (current high water mark: FE-10).

**Rules:**
- When a bug, gap, or deferred item is discovered during any work session, append it to the appropriate backlog file before closing the session — even if it's a one-liner latent observation.
- When an item is fixed, move it to the `## Closed` section with a reference to the resolving commit/PR. Never delete entries.
- Never describe something as "done" or "fixed" in conversation without also updating the backlog to reflect it.
- When starting work on an active item, check its backlog entry first — the "Suggested fix shape" and "Why deferred" fields exist to prevent re-discovering context.

## Workflow

Skill invocation rules for this project. These are mandatory, not suggestions.

| Situation | Invoke before anything else |
|-----------|----------------------------|
| New feature, UI component, or behaviour change | `superpowers:brainstorming` |
| Bug, test failure, or unexpected behaviour | `superpowers:systematic-debugging` |
| Multi-step task with a spec or requirements | `superpowers:writing-plans` |
| Figma URL or design file provided | `figma:figma-implement-design` |
| Executing a written plan | `superpowers:subagent-driven-development` |
| 2+ independent tasks that can run in parallel | `superpowers:dispatching-parallel-agents` |
| About to claim a task is done | `superpowers:verification-before-completion` |
| Completing a branch / deciding how to merge | `superpowers:finishing-a-development-branch` |
| Receiving code review feedback | `superpowers:receiving-code-review` |

Additional rules:
- Run `pnpm typecheck` and relevant tests before any completion claim — never assert passing without evidence.
- For new UI: build in the Layer 1 → Layer 2 order (primitives first, compose up). Do not reach for arbitrary HTML/Tailwind until the registry primitives are genuinely insufficient.
- For Payload collection changes: types + migration before any frontend work that depends on the new fields.

## Key invariants

- **Never** edit `src/components/ui/` by hand — regenerate via `pnpm registry:check --overwrite` or `pnpm dlx shadcn@latest add @siab/<component>`.
- **Always** regenerate types (`pnpm payload generate:types`) and create a migration after collection field changes.
- Super-admins have zero tenants; every other role has exactly one. Violating this breaks `evaluateGate` and the multi-tenant plugin's filter.
- Server actions must authenticate the caller from cookies/headers explicitly — there is no middleware-injected user on the server-action path.
- `beforeOperation` hooks (not `beforeChange` or `beforeValidate`) are the only reliable place to gate on the caller's original request data before field-level access strips it.
- The `BOOTSTRAP_TOKEN` env var enables the one-time super-admin seed endpoint. Unset it after first boot in production.
- Sessions are cleared on every password rotation via the `clearSessionsOnPasswordChange` `beforeValidate` hook. Do not disable `useSessions` on the Users collection.

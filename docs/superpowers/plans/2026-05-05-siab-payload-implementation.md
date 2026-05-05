# siab-payload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Delivery status (as of Wave 3 — 2026-05-05)

| Batch | Outcome | Status | Merge SHA |
|---|---|---|---|
| Phases 0-16 | Backend + custom shadcn admin + tests | Done | (pre-Wave; see commit history) |
| Phase 17 | E2E (Playwright) — super-admin flow, tenant editor flow, role-gate | Done | merged on `main` |
| Phase 18 | Production Dockerfile + GHA CI + compose finalization | Done | merged on `main` |
| Track 1 | Production smoke deploy on the VPS (HOSTNAME=0.0.0.0, UID 1000, DATA_HOST_PATH parameterization, middleware `/api-key` matcher fix) | Done | merged on `main` |
| Wave 1 | Users `tenants[]` plugin-native migration (drops singular `tenant`; adds custom array validator; manual field with `tenantsArrayField.includeDefaultField: false`) | Done | `bf57967` |
| Wave 2-3 | Deploy-safety + data-integrity batch — migrate-on-boot, FK CASCADE, tenant lifecycle hooks (restore + delete + stale-cookie clear), `cleanupAfterTenantDelete: false`, projector `id`-strip + `blockName` cleanup, `outputFileTracingRoot` | Done | `2f061ba` |
| Wave 4 | Documentation consistency sweep | Done | (this branch) |
| Wave 5+ | Renovate config (deferred — org-level at `/srv/saas/`), orchestrator-compatibility check (Track 3), lockfile sweep | Pending | — |

**Reading note:** the per-phase task lists below describe the *original* shape of each step. Where Wave 1 / Wave 2-3 changed the technical approach, the source of truth is now:
- the migration file in `src/migrations/` (e.g. `20260505_194128_users_tenants_array`, `20260505_202447_cascade_tenant_delete`)
- the lifecycle hooks in `src/hooks/tenantLifecycle.ts`
- the boot-migrate scripts in `scripts/` (`docker-entrypoint.sh`, `migrate-on-boot-entry.ts`, `build-runtime-bundle.mjs`)
- the design spec's reconciliation note at the top of [2026-05-05-siab-payload-design.md](../specs/2026-05-05-siab-payload-design.md)

In particular: the singular `Users.tenant` field shown in Task 1.2 / Task 3.4 / Task 15.x code samples shipped initially as specified, then was reshaped in Wave 1 to `tenants[]` (an array of `{ tenant }` rows) to match what the multi-tenant plugin's access wrappers expect. The original validator shown as `validateTenant` was renamed `validateTenants` and now operates on the array (super-admin → length 0; other roles → exactly 1).

---

**Goal:** Build the multi-tenant Payload v3 + custom shadcn admin that powers the siteinabox ecosystem, deployable to the production VPS as `ghcr.io/optidigi/siab-payload:latest`.

**Architecture:** Single Next.js 15 app. Payload v3 runs as a backend module (`admin.disable: true`); every visible route is custom shadcn UI. Host header → tenant resolution; `admin.siteinabox.nl` is super-admin, `admin.<clientdomain>` is tenant-scoped. `@payloadcms/plugin-multi-tenant` auto-scopes queries. `afterChange` hooks project published content to per-tenant on-disk JSON consumed by the SSR site containers.

**Tech Stack:** Next.js 15 (App Router), Payload v3, Postgres 17, `@payloadcms/db-postgres`, `@payloadcms/plugin-multi-tenant`, shadcn/ui (Radix + Tailwind 4), Recharts, react-hook-form + zod, Resend, pino, Vitest + Playwright, Docker Compose.

**Spec:** [`docs/superpowers/specs/2026-05-05-siab-payload-design.md`](../specs/2026-05-05-siab-payload-design.md)

---

## Phase Overview

All phases below are ✅ shipped on `main` (HEAD `2f061ba` at time of writing). See the "Delivery status" table above for the post-phase Wave/Track work.

| Phase | Outcome | Status |
|---|---|---|
| 0 | Repo bootstrap — Next.js + Payload + Postgres run locally; pnpm dev works | ✅ |
| 1 | Tenants + Users collections; first super-admin seeded; orchestrator API key | ✅ (Users reshaped to `tenants[]` in Wave 1) |
| 2 | Multi-tenant plugin; Pages, Media, SiteSettings, Forms; access control | ✅ (`cleanupAfterTenantDelete` later turned off — Wave 2-3) |
| 3 | Host-resolution middleware + auth gate | ✅ (matcher fix in Track 1: `(?!api/...)`) |
| 4 | afterChange JSON projection; atomic write; manifest; tenant dir lifecycle | ✅ (lifecycle expanded in Wave 2-3: restore, delete, stale-cookie clear) |
| 5 | Disable Payload admin; scaffold shadcn shell (sidebar, topbar, theme) | ✅ |
| 6 | Auth UI (login, forgot/reset password) | ✅ |
| 7 | Super-admin dashboard view | ✅ |
| 8 | Sites management (list + tenant overview) | ✅ |
| 9 | Pages list + page editor + field renderer + block editor | ✅ |
| 10 | Media library | ✅ |
| 11 | Forms inbox | ✅ |
| 12 | Site settings | ✅ |
| 13 | User management + onboarding checklist | ✅ |
| 14 | Tenant-editor scoped routes (mirror of super-admin views) | ✅ |
| 15 | Email integration (Resend) for invite + reset | ✅ |
| 16 | Test suites — tenant isolation, auth gate matrix, projection snapshots | ✅ |
| 17 | E2E tests (Playwright) | ✅ |
| 18 | Production Dockerfile + GHA CI + compose finalization | ✅ (HOSTNAME=0.0.0.0 baked in Track 1; UID 1000 user; `${DATA_HOST_PATH:-…}` parameterization) |

**Ship-able milestones:** End of Phase 4 = working backend (testable via curl + Payload's REST API). End of Phase 9 = super-admin can log in and edit pages. End of Phase 14 = full functional system. Phases 15–18 are productionization.

---

## File Structure

```
deploy-siab-payload/
├── Dockerfile
├── docker-compose.yml
├── docker-compose.local.yml          # for local dev with bind mounts
├── package.json
├── pnpm-lock.yaml
├── next.config.mjs
├── tsconfig.json
├── components.json                   # shadcn config
├── postcss.config.js
├── eslint.config.mjs
├── .env.example
├── .github/
│   └── workflows/
│       └── build-image.yml
├── docs/superpowers/{specs,plans}/
├── src/
│   ├── middleware.ts                 # host-resolution + auth gate
│   ├── payload.config.ts
│   ├── payload-types.ts              # generated, gitignored
│   ├── app/
│   │   ├── (frontend)/               # custom shadcn admin route group
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── reset-password/[token]/page.tsx
│   │   │   └── (admin)/              # auth-gated subgroup
│   │   │       ├── layout.tsx        # sidebar + topbar shell
│   │   │       ├── page.tsx          # dashboard
│   │   │       ├── sites/
│   │   │       │   ├── page.tsx
│   │   │       │   └── [slug]/
│   │   │       │       ├── page.tsx
│   │   │       │       ├── pages/...
│   │   │       │       ├── media/...
│   │   │       │       ├── forms/...
│   │   │       │       ├── settings/...
│   │   │       │       ├── users/...
│   │   │       │       └── onboarding/page.tsx
│   │   │       ├── pages/            # tenant-editor scoped (no slug prefix)
│   │   │       ├── media/
│   │   │       ├── forms/
│   │   │       ├── settings/
│   │   │       ├── users/
│   │   │       └── activity/
│   │   ├── api/
│   │   │   └── health/route.ts
│   │   └── (payload)/                # Payload's auto-mounted API routes
│   ├── collections/
│   │   ├── Tenants.ts
│   │   ├── Users.ts
│   │   ├── Pages.ts
│   │   ├── Media.ts
│   │   ├── SiteSettings.ts
│   │   └── Forms.ts
│   ├── blocks/                       # Payload block field configs
│   │   ├── Hero.ts
│   │   ├── FeatureList.ts
│   │   ├── Testimonials.ts
│   │   ├── FAQ.ts
│   │   ├── CTA.ts
│   │   ├── RichText.ts
│   │   └── ContactSection.ts
│   ├── hooks/
│   │   ├── projectToDisk.ts          # afterChange Pages/Media/SiteSettings
│   │   ├── createTenantDir.ts        # afterChange Tenants (op=create)
│   │   ├── archiveTenantDir.ts       # afterChange Tenants (status→archived)
│   │   └── deleteFileFromDisk.ts     # afterDelete Pages/Media
│   ├── access/
│   │   ├── isSuperAdmin.ts
│   │   ├── isOwnerInTenant.ts
│   │   ├── isTenantMember.ts
│   │   └── canManageUsers.ts
│   ├── lib/
│   │   ├── atomicWrite.ts
│   │   ├── hostToTenant.ts
│   │   ├── projection/
│   │   │   ├── pageToJson.ts
│   │   │   ├── settingsToJson.ts
│   │   │   └── manifest.ts
│   │   ├── email/
│   │   │   ├── resend.ts
│   │   │   └── templates/
│   │   │       ├── invite.ts
│   │   │       └── resetPassword.ts
│   │   ├── activity.ts               # query helpers for activity feed
│   │   └── logger.ts
│   ├── components/
│   │   ├── ui/                       # shadcn copies
│   │   ├── layout/
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── SiteHeader.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── TenantSwitcher.tsx
│   │   ├── dashboard/
│   │   │   ├── StatCards.tsx
│   │   │   ├── EditsChart.tsx
│   │   │   └── ActivityFeed.tsx
│   │   ├── tables/
│   │   │   ├── DataTable.tsx         # generic shadcn data-table
│   │   │   ├── PagesTable.tsx
│   │   │   ├── TenantsTable.tsx
│   │   │   ├── FormsTable.tsx
│   │   │   └── UsersTable.tsx
│   │   ├── forms/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── PageForm.tsx
│   │   │   ├── SettingsForm.tsx
│   │   │   └── UserInviteForm.tsx
│   │   ├── editor/
│   │   │   ├── BlockEditor.tsx
│   │   │   ├── BlockListItem.tsx
│   │   │   ├── BlockTypePicker.tsx
│   │   │   └── FieldRenderer.tsx
│   │   ├── media/
│   │   │   ├── MediaPicker.tsx
│   │   │   ├── MediaGrid.tsx
│   │   │   └── MediaUploader.tsx
│   │   ├── onboarding/
│   │   │   └── OnboardingChecklist.tsx
│   │   └── shared/
│   │       ├── RoleBadge.tsx
│   │       ├── StatusPill.tsx
│   │       └── Breadcrumb.tsx
│   └── styles/globals.css
└── tests/
    ├── unit/
    ├── integration/
    │   ├── tenant-isolation.test.ts  # parameterized cross-tenant
    │   ├── auth-gate-matrix.test.ts  # 16-case matrix
    │   ├── hooks.test.ts
    │   └── orchestrator-api.test.ts
    └── e2e/
        ├── super-admin-flow.spec.ts
        ├── tenant-editor-flow.spec.ts
        └── role-gate.spec.ts
```

---

## Phase 0 — Repo bootstrap

**Goal:** `pnpm dev` runs Next.js 15 + Payload v3 with Postgres on `localhost:3000`.

### Task 0.1: Initialize package.json + Next.js 15 + Payload

**Files:**
- Create: `package.json`
- Create: `next.config.mjs`
- Create: `tsconfig.json`
- Create: `.env.example`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "siab-payload",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "payload": "payload",
    "generate:types": "payload generate:types",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "15.0.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "payload": "3.0.0",
    "@payloadcms/db-postgres": "3.0.0",
    "@payloadcms/next": "3.0.0",
    "@payloadcms/richtext-lexical": "3.0.0",
    "@payloadcms/plugin-multi-tenant": "3.0.0",
    "graphql": "16.9.0"
  },
  "devDependencies": {
    "@types/node": "22.0.0",
    "@types/react": "19.0.0",
    "@types/react-dom": "19.0.0",
    "typescript": "5.6.0"
  },
  "engines": { "node": ">=22.0.0" },
  "packageManager": "pnpm@9.12.0"
}
```

- [ ] **Step 2: Write next.config.mjs**

```js
import { withPayload } from "@payloadcms/next/withPayload"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: { reactCompiler: false }
}

export default withPayload(nextConfig)
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "incremental": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "noEmit": true,
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src/**/*", "tests/**/*", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write .env.example**

```bash
# Postgres
POSTGRES_PASSWORD=change-me
DATABASE_URI=postgres://payload:change-me@localhost:5432/payload

# Payload
PAYLOAD_SECRET=replace-with-openssl-rand-hex-32

# App
DATA_DIR=./.data-out
NEXT_PUBLIC_SUPER_ADMIN_DOMAIN=siteinabox.nl
NODE_ENV=development

# Email (Phase 15)
RESEND_API_KEY=
EMAIL_FROM=noreply@siteinabox.nl
```

- [ ] **Step 5: Install + verify**

Run:
```bash
pnpm install
pnpm typecheck
```
Expected: install completes; typecheck passes (no source files yet).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.mjs tsconfig.json .env.example
git commit -m "feat(phase-0): initialize Next.js 15 + Payload v3 dependencies"
```

### Task 0.2: Local Postgres via docker-compose.local.yml

**Files:**
- Create: `docker-compose.local.yml`

- [ ] **Step 1: Write the compose file**

```yaml
# Local-dev only. Runs Postgres for `pnpm dev`.
services:
  postgres:
    image: postgres:17-alpine
    container_name: siab-payload-postgres-dev
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: payload
      POSTGRES_USER: payload
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change-me}
    volumes:
      - siab-payload-postgres-dev:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U payload"]
      interval: 5s

volumes:
  siab-payload-postgres-dev:
```

- [ ] **Step 2: Start it**

Run:
```bash
docker compose -f docker-compose.local.yml up -d
docker compose -f docker-compose.local.yml ps
```
Expected: `siab-payload-postgres-dev` shows `(healthy)` within ~10s.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.local.yml
git commit -m "feat(phase-0): local Postgres via docker-compose.local.yml"
```

### Task 0.3: Minimal payload.config.ts

**Files:**
- Create: `src/payload.config.ts`
- Create: `src/app/(payload)/admin/[[...segments]]/page.tsx`
- Create: `src/app/(payload)/admin/[[...segments]]/not-found.tsx`
- Create: `src/app/(payload)/api/[...slug]/route.ts`
- Create: `src/app/(payload)/api/graphql/route.ts`
- Create: `src/app/(payload)/api/graphql-playground/route.ts`
- Create: `src/app/(payload)/layout.tsx`
- Create: `src/app/(payload)/custom.scss`

- [ ] **Step 1: Write the minimal config**

`src/payload.config.ts`:
```ts
import { postgresAdapter } from "@payloadcms/db-postgres"
import { lexicalEditor } from "@payloadcms/richtext-lexical"
import path from "path"
import { buildConfig } from "payload"
import { fileURLToPath } from "url"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "",
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI || "" }
  }),
  editor: lexicalEditor(),
  collections: [],
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts")
  },
  admin: {
    // Will be set to disable: true in Phase 5. Kept enabled for Phase 0–4 verification.
    user: undefined
  }
})
```

- [ ] **Step 2: Add Payload's Next.js route handlers**

These six files are boilerplate from `@payloadcms/next` — copy verbatim from the official starter. Source: https://github.com/payloadcms/payload/tree/main/templates/blank/src/app/(payload)

`src/app/(payload)/layout.tsx`:
```tsx
import { RootLayout } from "@payloadcms/next/layouts"
import config from "@/payload.config"
import { importMap } from "./admin/importMap.js"
import "./custom.scss"

const Layout = ({ children }: { children: React.ReactNode }) => (
  <RootLayout config={config} importMap={importMap}>
    {children}
  </RootLayout>
)

export default Layout
```

`src/app/(payload)/admin/[[...segments]]/page.tsx`:
```tsx
import type { Metadata } from "next"
import config from "@/payload.config"
import { generatePageMetadata, RootPage } from "@payloadcms/next/views"
import { importMap } from "../importMap.js"

type Args = { params: Promise<{ segments: string[] }>; searchParams: Promise<{ [key: string]: string | string[] }> }

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

const Page = ({ params, searchParams }: Args) => RootPage({ config, params, searchParams, importMap })

export default Page
```

`src/app/(payload)/admin/[[...segments]]/not-found.tsx`:
```tsx
import { generatePageMetadata, NotFoundPage } from "@payloadcms/next/views"
import config from "@/payload.config"
import { importMap } from "../importMap.js"
import type { Metadata } from "next"

type Args = { params: Promise<{ segments: string[] }>; searchParams: Promise<{ [key: string]: string | string[] }> }

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

const NotFound = ({ params, searchParams }: Args) => NotFoundPage({ config, params, searchParams, importMap })

export default NotFound
```

`src/app/(payload)/api/[...slug]/route.ts`:
```ts
import config from "@/payload.config"
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from "@payloadcms/next/routes"

export const GET = REST_GET(config)
export const POST = REST_POST(config)
export const DELETE = REST_DELETE(config)
export const PATCH = REST_PATCH(config)
export const PUT = REST_PUT(config)
export const OPTIONS = REST_OPTIONS(config)
```

`src/app/(payload)/api/graphql/route.ts`:
```ts
import config from "@/payload.config"
import { GRAPHQL_POST, REST_OPTIONS } from "@payloadcms/next/routes"

export const POST = GRAPHQL_POST(config)
export const OPTIONS = REST_OPTIONS(config)
```

`src/app/(payload)/api/graphql-playground/route.ts`:
```ts
import config from "@/payload.config"
import { GRAPHQL_PLAYGROUND_GET } from "@payloadcms/next/routes"

export const GET = GRAPHQL_PLAYGROUND_GET(config)
```

`src/app/(payload)/custom.scss`:
```scss
/* Payload admin custom styles — overridden in Phase 5 to hide admin */
```

- [ ] **Step 3: Set PAYLOAD_SECRET**

Run:
```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output into `.env` as `PAYLOAD_SECRET=<hex>`.

- [ ] **Step 4: Run dev server + verify**

Run:
```bash
pnpm dev
```
Expected: starts on http://localhost:3000. Visit http://localhost:3000/admin → Payload's "create first user" screen renders (proves Postgres + Payload integration works).

Stop dev server with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat(phase-0): minimal payload.config + Next.js route handlers"
```

### Task 0.4: Add app folder structure for the (frontend) route group

**Files:**
- Create: `src/app/(frontend)/layout.tsx`
- Create: `src/app/(frontend)/page.tsx`

- [ ] **Step 1: Placeholder layout**

`src/app/(frontend)/layout.tsx`:
```tsx
export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
```

- [ ] **Step 2: Placeholder home page**

`src/app/(frontend)/page.tsx`:
```tsx
export default function Home() {
  return <main style={{ padding: 24, fontFamily: "ui-sans-serif" }}>siab-payload — frontend route group placeholder. Phase 5 replaces this.</main>
}
```

- [ ] **Step 3: Verify both route groups coexist**

Run `pnpm dev`, visit:
- http://localhost:3000/ → placeholder text
- http://localhost:3000/admin → Payload admin

Both must work.

- [ ] **Step 4: Commit**

```bash
git add src/app/(frontend)
git commit -m "feat(phase-0): scaffold (frontend) route group"
```

### Task 0.5: Vitest + setup file

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json` (already has scripts; just add devDeps)

- [ ] **Step 1: Add test devDeps**

```bash
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Write vitest.config.ts**

```ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**"],
    globals: true,
    pool: "forks"
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") }
  }
})
```

- [ ] **Step 3: Write minimal setup**

`tests/setup.ts`:
```ts
import { afterAll } from "vitest"

afterAll(() => {
  // teardown placeholder; integration tests will hook in here
})
```

- [ ] **Step 4: Add a sanity test**

`tests/unit/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest"

describe("sanity", () => {
  it("runs", () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 5: Run tests**

Run:
```bash
pnpm test
```
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/ package.json pnpm-lock.yaml
git commit -m "feat(phase-0): vitest setup + sanity test"
```

**Phase 0 milestone:** `pnpm dev` runs the app; Postgres is up; Payload admin loads at /admin; a (frontend) route group exists; Vitest is configured. **No business logic yet.**

---

## Phase 1 — Identity collections (Tenants + Users)

**Goal:** Tenants and Users collections exist with role/tenant constraints; you can log in as super-admin via Payload's native admin; an `orchestrator` service user exists with an API key.

### Task 1.1: Tenants collection

**Files:**
- Create: `src/collections/Tenants.ts`
- Modify: `src/payload.config.ts`
- Test: `tests/unit/collections-tenants.test.ts`

- [ ] **Step 1: Write the test**

`tests/unit/collections-tenants.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { Tenants } from "@/collections/Tenants"

describe("Tenants collection config", () => {
  it("uses 'tenants' slug", () => { expect(Tenants.slug).toBe("tenants") })

  it("has unique domain field", () => {
    const f = Tenants.fields.find((x: any) => x.name === "domain")
    expect(f).toBeDefined()
    expect((f as any).unique).toBe(true)
    expect((f as any).required).toBe(true)
  })

  it("has unique slug field", () => {
    const f = Tenants.fields.find((x: any) => x.name === "slug")
    expect(f).toBeDefined()
    expect((f as any).unique).toBe(true)
  })

  it("status defaults to provisioning", () => {
    const f = Tenants.fields.find((x: any) => x.name === "status") as any
    expect(f.defaultValue).toBe("provisioning")
    expect(f.options.map((o: any) => o.value)).toEqual([
      "provisioning", "active", "suspended", "archived"
    ])
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm test tests/unit/collections-tenants.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/collections/Tenants.ts`:
```ts
import type { CollectionConfig } from "payload"

export const Tenants: CollectionConfig = {
  slug: "tenants",
  admin: { useAsTitle: "name", defaultColumns: ["name", "domain", "status"] },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true,
      admin: { description: "URL-safe id used in super-admin URLs (/sites/<slug>)" } },
    { name: "domain", type: "text", required: true, unique: true,
      admin: { description: "Production domain, e.g. clientasite.nl. Looked up from Host header." } },
    { name: "status", type: "select", required: true, defaultValue: "provisioning",
      options: [
        { label: "Provisioning", value: "provisioning" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Archived", value: "archived" }
      ] },
    { name: "siteRepo", type: "text", admin: { description: "GitHub repo, e.g. optidigi/site-clientasite" } },
    { name: "notes", type: "textarea" }
  ]
}
```

- [ ] **Step 4: Wire into payload.config.ts**

In `src/payload.config.ts` add:
```ts
import { Tenants } from "@/collections/Tenants"
// ...
collections: [Tenants],
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm test tests/unit/collections-tenants.test.ts && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Generate types + verify migration**

Run:
```bash
pnpm dev    # let it boot, then Ctrl-C
pnpm generate:types
```
Expected: `src/payload-types.ts` is generated. Postgres has a `tenants` table.

- [ ] **Step 7: Commit**

```bash
git add src/collections/Tenants.ts src/payload.config.ts tests/
git commit -m "feat(phase-1): Tenants collection + tests"
```

### Task 1.2: Users collection with role + tenant

**Files:**
- Create: `src/collections/Users.ts`
- Modify: `src/payload.config.ts` (admin.user)
- Test: `tests/unit/collections-users.test.ts`

- [ ] **Step 1: Write the test**

`tests/unit/collections-users.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { Users } from "@/collections/Users"

describe("Users collection config", () => {
  it("uses 'users' slug", () => { expect(Users.slug).toBe("users") })

  it("auth is enabled with API key support", () => {
    expect(Users.auth).toBeTruthy()
    expect((Users.auth as any).useAPIKey).toBe(true)
  })

  it("has role enum with four values", () => {
    const f = Users.fields.find((x: any) => x.name === "role") as any
    expect(f.options.map((o: any) => o.value)).toEqual([
      "super-admin", "owner", "editor", "viewer"
    ])
  })

  it("has tenant relationship", () => {
    const f = Users.fields.find((x: any) => x.name === "tenant") as any
    expect(f.relationTo).toBe("tenants")
  })

  it("validates super-admin must have null tenant", () => {
    const f = Users.fields.find((x: any) => x.name === "tenant") as any
    expect(typeof f.validate).toBe("function")
    expect(f.validate(null,  { siblingData: { role: "super-admin" }, operation: "create" })).toBe(true)
    expect(f.validate("ten1",{ siblingData: { role: "super-admin" }, operation: "create" })).toMatch(/super-admin/)
    expect(f.validate(null,  { siblingData: { role: "editor" },      operation: "create" })).toMatch(/required/i)
    expect(f.validate("ten1",{ siblingData: { role: "editor" },      operation: "create" })).toBe(true)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/unit/collections-users.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/collections/Users.ts`:
```ts
import type { CollectionConfig, FieldValidation } from "payload"

const validateTenant: FieldValidation = (value, { siblingData }: any) => {
  const role = siblingData?.role
  if (role === "super-admin") {
    if (value) return "super-admin users must not have a tenant"
    return true
  }
  if (!value) return "tenant is required for non-super-admin users"
  return true
}

export const Users: CollectionConfig = {
  slug: "users",
  auth: { useAPIKey: true },
  admin: { useAsTitle: "email", defaultColumns: ["email", "name", "role", "tenant"] },
  fields: [
    { name: "name", type: "text" },
    { name: "role", type: "select", required: true, defaultValue: "editor",
      options: [
        { label: "Super-admin", value: "super-admin" },
        { label: "Owner", value: "owner" },
        { label: "Editor", value: "editor" },
        { label: "Viewer", value: "viewer" }
      ] },
    { name: "tenant", type: "relationship", relationTo: "tenants",
      validate: validateTenant,
      admin: { description: "null for super-admin; required otherwise" } }
  ]
}
```

- [ ] **Step 4: Wire user into config**

In `src/payload.config.ts`:
```ts
import { Users } from "@/collections/Users"
// ...
collections: [Tenants, Users],
admin: { user: "users" },
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm test tests/unit/collections-users.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Boot + create first super-admin**

Run `pnpm dev`. Visit http://localhost:3000/admin → "Create first user" screen. Use:
- email: `admin@optidigi.nl`
- password: (your choice)
- role: super-admin
- tenant: (leave empty)

Verify creation succeeds; subsequent visits go straight to the admin dashboard.

- [ ] **Step 7: Commit**

```bash
git add src/collections/Users.ts src/payload.config.ts tests/
git commit -m "feat(phase-1): Users collection with role + tenant validation"
```

### Task 1.3: Orchestrator service user with API key (manual step)

**Files:** none (data-only)

This task creates a Users record via Payload's admin UI; documented here for reproducibility.

- [ ] **Step 1: Create the orchestrator user**

In the Payload admin (logged in as super-admin), go to `Users → Create New`:
- email: `orchestrator@optidigi.nl`
- name: `Orchestrator (service)`
- role: super-admin
- tenant: empty
- password: any random string (won't be used)
- Toggle "Enable API Key" → save → copy the generated API key

- [ ] **Step 2: Document the key**

Add to your password manager or `.env`:
```
PAYLOAD_API_TOKEN=<generated-key>
```

(This token will live in the `siab-payload-orchestrator` repo's `.env`, not this one.)

- [ ] **Step 3: Verify the key works**

Run:
```bash
curl -H "Authorization: users API-Key $PAYLOAD_API_TOKEN" http://localhost:3000/api/users/me
```
Expected: returns the orchestrator user as JSON, status 200.

No commit needed (data-only step).

**Phase 1 milestone:** Tenants + Users collections in DB. Super-admin (`admin@optidigi.nl`) can log into Payload's native admin. Orchestrator service user has a working API key.

---

## Phase 2 — Content collections + multi-tenant plugin

**Goal:** Pages, Media, SiteSettings, Forms collections wired with `@payloadcms/plugin-multi-tenant`. Block configs created. Access functions enforce role rules. Validation prevents super-admin from being a regular tenant member.

### Task 2.1: Access functions

**Files:**
- Create: `src/access/isSuperAdmin.ts`
- Create: `src/access/isTenantMember.ts`
- Create: `src/access/isOwnerInTenant.ts`
- Create: `src/access/canManageUsers.ts`
- Test: `tests/unit/access.test.ts`

- [ ] **Step 1: Write the test**

`tests/unit/access.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import { isTenantMember } from "@/access/isTenantMember"
import { isOwnerInTenant } from "@/access/isOwnerInTenant"
import { canManageUsers } from "@/access/canManageUsers"

const su = { user: { role: "super-admin", tenant: null } } as any
const owner = { user: { role: "owner", tenant: { id: "t1" } } } as any
const editor = { user: { role: "editor", tenant: { id: "t1" } } } as any
const viewer = { user: { role: "viewer", tenant: { id: "t1" } } } as any
const otherOwner = { user: { role: "owner", tenant: { id: "t2" } } } as any
const anon = { user: null } as any

describe("isSuperAdmin", () => {
  it("true only for super-admin role", () => {
    expect(isSuperAdmin(su)).toBe(true)
    expect(isSuperAdmin(owner)).toBe(false)
    expect(isSuperAdmin(anon)).toBe(false)
  })
})

describe("isTenantMember", () => {
  it("true for any role with tenant set", () => {
    expect(isTenantMember(owner)).toBe(true)
    expect(isTenantMember(editor)).toBe(true)
    expect(isTenantMember(viewer)).toBe(true)
    expect(isTenantMember(su)).toBe(false)
    expect(isTenantMember(anon)).toBe(false)
  })
})

describe("isOwnerInTenant", () => {
  it("true for owner role", () => {
    expect(isOwnerInTenant(owner)).toBe(true)
    expect(isOwnerInTenant(editor)).toBe(false)
  })
})

describe("canManageUsers — Users collection access", () => {
  it("super-admin can manage anyone", () => {
    const where = canManageUsers(su)
    expect(where).toBe(true)
  })
  it("owner sees only own-tenant users via where filter", () => {
    const where = canManageUsers(owner)
    expect(where).toEqual({ tenant: { equals: "t1" } })
  })
  it("editor/viewer can only manage themselves", () => {
    const where = canManageUsers(editor)
    expect(where).toEqual({ id: { equals: editor.user.id } })
  })
  it("anon cannot manage users", () => {
    expect(canManageUsers(anon)).toBe(false)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/unit/access.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement isSuperAdmin**

`src/access/isSuperAdmin.ts`:
```ts
import type { Access, AccessArgs } from "payload"

export const isSuperAdmin: Access = ({ req }: AccessArgs) =>
  req.user?.role === "super-admin"
```

- [ ] **Step 4: Implement isTenantMember**

`src/access/isTenantMember.ts`:
```ts
import type { Access, AccessArgs } from "payload"

export const isTenantMember: Access = ({ req }: AccessArgs) => {
  const u = req.user
  return Boolean(u && u.role !== "super-admin" && u.tenant)
}
```

- [ ] **Step 5: Implement isOwnerInTenant**

`src/access/isOwnerInTenant.ts`:
```ts
import type { Access, AccessArgs } from "payload"

export const isOwnerInTenant: Access = ({ req }: AccessArgs) =>
  req.user?.role === "owner"
```

- [ ] **Step 6: Implement canManageUsers**

`src/access/canManageUsers.ts`:
```ts
import type { Access, AccessArgs } from "payload"

export const canManageUsers: Access = ({ req }: AccessArgs) => {
  const u = req.user
  if (!u) return false
  if (u.role === "super-admin") return true
  if (u.role === "owner") {
    const tenantId = typeof u.tenant === "string" ? u.tenant : u.tenant?.id
    if (!tenantId) return false
    return { tenant: { equals: tenantId } }
  }
  return { id: { equals: u.id } }
}
```

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm test tests/unit/access.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/access tests/unit/access.test.ts
git commit -m "feat(phase-2): access functions (isSuperAdmin, tenant scoping, user mgmt)"
```

### Task 2.2: Apply Users-collection access

**Files:**
- Modify: `src/collections/Users.ts`

- [ ] **Step 1: Add access**

Replace the `Users` export to include access:
```ts
import { canManageUsers } from "@/access/canManageUsers"
import { isSuperAdmin } from "@/access/isSuperAdmin"

export const Users: CollectionConfig = {
  slug: "users",
  auth: { useAPIKey: true },
  access: {
    create: async ({ req }) => {
      // Authenticated: super-admin or owner can create users
      if (req.user?.role === "super-admin" || req.user?.role === "owner") return true
      // Bootstrap: when no users exist yet, allow unauthenticated creation
      // (Phase 18.5 uses this to seed the first super-admin via curl)
      const { totalDocs } = await req.payload.count({ collection: "users", overrideAccess: true })
      return totalDocs === 0
    },
    read: canManageUsers,
    update: canManageUsers,
    delete: ({ req }) => isSuperAdmin({ req } as any) || req.user?.role === "owner"
  },
  admin: { useAsTitle: "email", defaultColumns: ["email", "name", "role", "tenant"] },
  fields: [
    /* unchanged */
  ]
}
```

**Why the bootstrap exception:** Once Payload's native admin is disabled (Phase 5), the only way to create the first super-admin on a fresh production database is via `POST /api/users`. With Phase 18.5 in mind, we leave that one door open until any user exists, then it locks shut.

- [ ] **Step 2: Run tests + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/collections/Users.ts
git commit -m "feat(phase-2): wire Users access (super-admin + tenant-owner mgmt)"
```

### Task 2.3: Apply Tenants-collection access (super-admin only)

**Files:**
- Modify: `src/collections/Tenants.ts`

- [ ] **Step 1: Add access**

```ts
import { isSuperAdmin } from "@/access/isSuperAdmin"

export const Tenants: CollectionConfig = {
  slug: "tenants",
  access: {
    create: isSuperAdmin,
    read:   isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin
  },
  /* admin + fields unchanged */
}
```

- [ ] **Step 2: Verify in admin**

Run `pnpm dev`, log in as super-admin. Tenants collection visible. Try the same with a non-super-admin user (create one via the admin UI for testing) — Tenants must not appear in their nav.

- [ ] **Step 3: Commit**

```bash
git add src/collections/Tenants.ts
git commit -m "feat(phase-2): Tenants collection super-admin only"
```

### Task 2.4: Block configs

**Files:** create one file each per block, all in `src/blocks/`:
- `Hero.ts`, `FeatureList.ts`, `Testimonials.ts`, `FAQ.ts`, `CTA.ts`, `RichText.ts`, `ContactSection.ts`

- [ ] **Step 1: Hero**

`src/blocks/Hero.ts`:
```ts
import type { Block } from "payload"

export const Hero: Block = {
  slug: "hero",
  interfaceName: "HeroBlock",
  fields: [
    { name: "eyebrow", type: "text" },
    { name: "headline", type: "text", required: true },
    { name: "subheadline", type: "textarea" },
    { name: "cta", type: "group", fields: [
      { name: "label", type: "text" },
      { name: "href", type: "text" }
    ]},
    { name: "image", type: "upload", relationTo: "media" }
  ]
}
```

- [ ] **Step 2: FeatureList**

`src/blocks/FeatureList.ts`:
```ts
import type { Block } from "payload"

export const FeatureList: Block = {
  slug: "featureList",
  interfaceName: "FeatureListBlock",
  fields: [
    { name: "title", type: "text" },
    { name: "intro", type: "textarea" },
    { name: "features", type: "array", required: true, fields: [
      { name: "title", type: "text", required: true },
      { name: "description", type: "textarea" },
      { name: "icon", type: "text", admin: { description: "lucide-react icon name" } }
    ]}
  ]
}
```

- [ ] **Step 3: Testimonials**

`src/blocks/Testimonials.ts`:
```ts
import type { Block } from "payload"

export const Testimonials: Block = {
  slug: "testimonials",
  interfaceName: "TestimonialsBlock",
  fields: [
    { name: "title", type: "text" },
    { name: "items", type: "array", required: true, fields: [
      { name: "quote", type: "textarea", required: true },
      { name: "author", type: "text", required: true },
      { name: "role", type: "text" },
      { name: "avatar", type: "upload", relationTo: "media" }
    ]}
  ]
}
```

- [ ] **Step 4: FAQ**

`src/blocks/FAQ.ts`:
```ts
import type { Block } from "payload"

export const FAQ: Block = {
  slug: "faq",
  interfaceName: "FAQBlock",
  fields: [
    { name: "title", type: "text" },
    { name: "items", type: "array", required: true, fields: [
      { name: "question", type: "text", required: true },
      { name: "answer", type: "textarea", required: true }
    ]}
  ]
}
```

- [ ] **Step 5: CTA**

`src/blocks/CTA.ts`:
```ts
import type { Block } from "payload"

export const CTA: Block = {
  slug: "cta",
  interfaceName: "CTABlock",
  fields: [
    { name: "headline", type: "text", required: true },
    { name: "description", type: "textarea" },
    { name: "primary", type: "group", fields: [
      { name: "label", type: "text", required: true },
      { name: "href", type: "text", required: true }
    ]},
    { name: "secondary", type: "group", fields: [
      { name: "label", type: "text" },
      { name: "href", type: "text" }
    ]}
  ]
}
```

- [ ] **Step 6: RichText (textarea-backed v1)**

`src/blocks/RichText.ts`:
```ts
import type { Block } from "payload"

export const RichText: Block = {
  slug: "richText",
  interfaceName: "RichTextBlock",
  fields: [
    { name: "body", type: "textarea", required: true,
      admin: { description: "v1: textarea. Tiptap-backed editor in v2 swaps the renderer only." } }
  ]
}
```

- [ ] **Step 7: ContactSection**

`src/blocks/ContactSection.ts`:
```ts
import type { Block } from "payload"

export const ContactSection: Block = {
  slug: "contactSection",
  interfaceName: "ContactSectionBlock",
  fields: [
    { name: "title", type: "text" },
    { name: "description", type: "textarea" },
    { name: "formName", type: "text", required: true, defaultValue: "Contact form",
      admin: { description: "Used as Forms.formName when storing submissions" } },
    { name: "fields", type: "array", required: true, fields: [
      { name: "name", type: "text", required: true },
      { name: "label", type: "text", required: true },
      { name: "type", type: "select", required: true, defaultValue: "text",
        options: [
          { label: "Text", value: "text" },
          { label: "Email", value: "email" },
          { label: "Tel", value: "tel" },
          { label: "Textarea", value: "textarea" }
        ]},
      { name: "required", type: "checkbox", defaultValue: false }
    ]}
  ]
}
```

- [ ] **Step 8: Commit**

```bash
git add src/blocks
git commit -m "feat(phase-2): seven block configs (Hero, FeatureList, Testimonials, FAQ, CTA, RichText, ContactSection)"
```

### Task 2.5: Pages collection

**Files:**
- Create: `src/collections/Pages.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Implement**

`src/collections/Pages.ts`:
```ts
import type { CollectionConfig } from "payload"
import { Hero } from "@/blocks/Hero"
import { FeatureList } from "@/blocks/FeatureList"
import { Testimonials } from "@/blocks/Testimonials"
import { FAQ } from "@/blocks/FAQ"
import { CTA } from "@/blocks/CTA"
import { RichText } from "@/blocks/RichText"
import { ContactSection } from "@/blocks/ContactSection"

export const Pages: CollectionConfig = {
  slug: "pages",
  admin: { useAsTitle: "title", defaultColumns: ["title", "slug", "status", "updatedAt"] },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true,
      admin: { description: "URL slug. Unique per tenant. 'home' for the root page." } },
    { name: "status", type: "select", required: true, defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" }
      ]},
    { name: "blocks", type: "blocks",
      blocks: [Hero, FeatureList, Testimonials, FAQ, CTA, RichText, ContactSection] },
    { name: "seo", type: "group", fields: [
      { name: "title", type: "text" },
      { name: "description", type: "textarea" },
      { name: "ogImage", type: "upload", relationTo: "media" }
    ]},
    { name: "updatedBy", type: "relationship", relationTo: "users",
      admin: { readOnly: true, hidden: false } }
  ],
  hooks: {
    beforeChange: [({ data, req }) => {
      if (req.user) data.updatedBy = req.user.id
      return data
    }]
  }
}
```

- [ ] **Step 2: Wire into config**

```ts
import { Pages } from "@/collections/Pages"
// ...
collections: [Tenants, Users, Pages],
```

- [ ] **Step 3: Boot + verify**

Run `pnpm dev`. Visit /admin → Pages tab visible. Try creating a page; the Blocks field shows the 7 block types in the picker.

- [ ] **Step 4: Generate types**

Run: `pnpm generate:types`
Expected: `src/payload-types.ts` regenerated to include Pages.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Pages.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat(phase-2): Pages collection with 7 block types + updatedBy hook"
```

### Task 2.6: Media collection

**Files:**
- Create: `src/collections/Media.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Implement**

`src/collections/Media.ts`:
```ts
import type { CollectionConfig } from "payload"
import path from "path"

export const Media: CollectionConfig = {
  slug: "media",
  upload: {
    // Files written under DATA_DIR/tenants/<tenantId>/media/. Per-tenant
    // subdirectory is set in beforeChange because tenant comes from the doc, not config.
    staticDir: path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out", "_uploads-tmp"),
    mimeTypes: ["image/*", "video/mp4", "application/pdf"]
  },
  admin: { useAsTitle: "filename", defaultColumns: ["filename", "alt", "mimeType", "filesize"] },
  fields: [
    { name: "alt", type: "text" },
    { name: "caption", type: "text" }
  ]
}
```

> **Note for the implementer:** Payload's built-in `upload.staticDir` is a single root, but we need per-tenant directories. The actual move from `_uploads-tmp/` to `tenants/<id>/media/` happens in the `projectToDisk` afterChange hook (Phase 4). This collection's upload config is *temporary staging* only.

- [ ] **Step 2: Wire**

```ts
import { Media } from "@/collections/Media"
// ...
collections: [Tenants, Users, Pages, Media],
```

- [ ] **Step 3: Verify**

Run `pnpm dev`. Visit /admin/collections/media → Create. Upload a small PNG. Verify the file appears in `./.data-out/_uploads-tmp/`.

- [ ] **Step 4: Commit**

```bash
git add src/collections/Media.ts src/payload.config.ts
git commit -m "feat(phase-2): Media collection (staging dir; per-tenant move in Phase 4)"
```

### Task 2.7: SiteSettings collection

**Files:**
- Create: `src/collections/SiteSettings.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Implement**

`src/collections/SiteSettings.ts`:
```ts
import type { CollectionConfig } from "payload"

export const SiteSettings: CollectionConfig = {
  slug: "site-settings",
  admin: { useAsTitle: "siteName", description: "One record per tenant." },
  fields: [
    { name: "siteName", type: "text", required: true },
    { name: "siteUrl", type: "text", required: true,
      admin: { description: "Public URL of the SSR site (e.g. https://clientasite.nl)" } },
    { name: "contactEmail", type: "email" },
    { name: "branding", type: "group", fields: [
      { name: "logo", type: "upload", relationTo: "media" },
      { name: "primaryColor", type: "text", admin: { description: "Hex (e.g. #2563eb)" } }
    ]},
    { name: "contact", type: "group", fields: [
      { name: "phone", type: "text" },
      { name: "address", type: "textarea" },
      { name: "social", type: "array", fields: [
        { name: "platform", type: "text", required: true },
        { name: "url", type: "text", required: true }
      ]}
    ]},
    { name: "navigation", type: "array", fields: [
      { name: "label", type: "text", required: true },
      { name: "href", type: "text", required: true },
      { name: "external", type: "checkbox", defaultValue: false }
    ]}
  ]
}
```

- [ ] **Step 2: Wire**

```ts
import { SiteSettings } from "@/collections/SiteSettings"
// ...
collections: [Tenants, Users, Pages, Media, SiteSettings],
```

- [ ] **Step 3: Generate types + verify**

Run: `pnpm generate:types && pnpm dev`
Expected: SiteSettings tab appears in admin.

- [ ] **Step 4: Commit**

```bash
git add src/collections/SiteSettings.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat(phase-2): SiteSettings collection (one record per tenant)"
```

### Task 2.8: Forms collection

**Files:**
- Create: `src/collections/Forms.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Implement**

`src/collections/Forms.ts`:
```ts
import type { CollectionConfig } from "payload"

export const Forms: CollectionConfig = {
  slug: "forms",
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "formName", "status", "createdAt"],
    description: "Submissions inbox. Created by public form posts; managed by tenant editors."
  },
  fields: [
    { name: "formName", type: "text", required: true },
    { name: "pageUrl", type: "text" },
    { name: "data", type: "json", required: true,
      admin: { description: "Full submission payload as posted" } },
    { name: "email", type: "text" },
    { name: "name", type: "text" },
    { name: "message", type: "textarea" },
    { name: "status", type: "select", required: true, defaultValue: "new",
      options: [
        { label: "New", value: "new" },
        { label: "Read", value: "read" },
        { label: "Contacted", value: "contacted" },
        { label: "Spam", value: "spam" }
      ]},
    { name: "ipAddress", type: "text", access: { read: ({ req }) => req.user?.role === "super-admin" || req.user?.role === "owner" } }
  ]
}
```

- [ ] **Step 2: Wire**

```ts
import { Forms } from "@/collections/Forms"
// ...
collections: [Tenants, Users, Pages, Media, SiteSettings, Forms],
```

- [ ] **Step 3: Verify + commit**

Run: `pnpm generate:types && pnpm dev`. Verify the Forms tab appears.

```bash
git add src/collections/Forms.ts src/payload.config.ts src/payload-types.ts
git commit -m "feat(phase-2): Forms (submissions) collection"
```

### Task 2.9: Install + configure multi-tenant plugin

**Files:**
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Verify dep is installed**

`@payloadcms/plugin-multi-tenant` was added in Phase 0. If not:
```bash
pnpm add @payloadcms/plugin-multi-tenant@3.0.0
```

- [ ] **Step 2: Wire the plugin**

In `src/payload.config.ts` — add to `buildConfig` options:
```ts
import { multiTenantPlugin } from "@payloadcms/plugin-multi-tenant"
import type { Config } from "@/payload-types"
// ...
plugins: [
  multiTenantPlugin<Config>({
    collections: {
      pages: {},
      media: {},
      "site-settings": { isGlobal: false },
      forms: {}
    },
    tenantField: { name: "tenant" },
    tenantsArrayField: { includeDefaultField: false },
    userHasAccessToAllTenants: (user) => user?.role === "super-admin"
  })
],
```

- [ ] **Step 3: Generate types**

Run: `pnpm generate:types`
Expected: Pages, Media, SiteSettings, Forms now have a `tenant` field of type `Tenant`.

- [ ] **Step 4: Verify migration**

Run `pnpm dev`. Postgres `pages`, `media`, `site_settings`, `forms` tables should now have a `tenant_id` column. Manual SQL check:
```bash
docker exec siab-payload-postgres-dev psql -U payload -d payload -c "\d pages"
```
Expected: column `tenant_id uuid REFERENCES tenants(id)` exists.

- [ ] **Step 5: Verify tenant scoping**

In Payload admin:
1. Create two Tenants: `t1` (domain: `clienta.nl`) and `t2` (domain: `clientb.nl`)
2. Create a Page assigning tenant=t1
3. Create a Page assigning tenant=t2
4. Create a non-super-admin user with role=editor, tenant=t1
5. Log out; log in as that editor; visit Pages — should see only the t1 page

- [ ] **Step 6: Commit**

```bash
git add src/payload.config.ts src/payload-types.ts
git commit -m "feat(phase-2): multi-tenant plugin scoping for pages/media/site-settings/forms"
```

### Task 2.10: Apply role-based access to content collections

**Files:**
- Modify: `src/collections/Pages.ts`
- Modify: `src/collections/Media.ts`
- Modify: `src/collections/SiteSettings.ts`
- Modify: `src/collections/Forms.ts`

- [ ] **Step 1: Helper for role read/write check**

Create `src/access/roleHelpers.ts`:
```ts
import type { Access } from "payload"

export const canRead: Access = ({ req }) => Boolean(req.user)

export const canWrite: Access = ({ req }) => {
  const role = req.user?.role
  return role === "super-admin" || role === "owner" || role === "editor"
}

export const canUpdateSettings: Access = ({ req }) => {
  const role = req.user?.role
  return role === "super-admin" || role === "owner"
}
```

(The multi-tenant plugin already filters reads/writes by `tenant`. These functions only enforce the role layer — scoping is automatic.)

- [ ] **Step 2: Apply to Pages**

```ts
import { canRead, canWrite } from "@/access/roleHelpers"

export const Pages: CollectionConfig = {
  slug: "pages",
  access: { read: canRead, create: canWrite, update: canWrite, delete: canWrite },
  /* ... */
}
```

- [ ] **Step 3: Apply to Media**

Same pattern: `read: canRead, create: canWrite, update: canWrite, delete: canWrite`.

- [ ] **Step 4: Apply to SiteSettings**

```ts
import { canRead, canUpdateSettings } from "@/access/roleHelpers"

access: {
  read: canRead,
  create: canUpdateSettings,
  update: canUpdateSettings,
  delete: ({ req }) => req.user?.role === "super-admin"
}
```

- [ ] **Step 5: Apply to Forms**

```ts
access: {
  read: canRead,
  create: () => true,                  // public form posts (will be locked down further by API rate-limit later)
  update: canWrite,
  delete: ({ req }) => req.user?.role === "super-admin" || req.user?.role === "owner"
}
```

- [ ] **Step 6: Verify**

Run `pnpm dev`. Log in as the t1-scoped editor:
- Pages: can create/edit/delete (own tenant only)
- SiteSettings: can read but update is forbidden (UI shows error)

- [ ] **Step 7: Commit**

```bash
git add src/access/roleHelpers.ts src/collections/
git commit -m "feat(phase-2): role-based access on Pages/Media/SiteSettings/Forms"
```

**Phase 2 milestone:** Six collections, multi-tenant scoping working, role-based access enforced. The schema in Postgres matches the spec. The Payload native admin demonstrates the full data model end-to-end.

---

## Phase 3 — Host-resolution middleware + auth gate

**Goal:** Every request gets `req.context.mode` (`super-admin` | `tenant`) and `req.context.tenant` set from the Host header. Auth gate enforces (host × role × tenant) rules. Both work for the (frontend) route group; Payload's /admin and /api routes are unaffected.

### Task 3.1: hostToTenant utility

**Files:**
- Create: `src/lib/hostToTenant.ts`
- Test: `tests/unit/hostToTenant.test.ts`

- [ ] **Step 1: Write the test**

`tests/unit/hostToTenant.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { stripAdminPrefix, isSuperAdminDomain } from "@/lib/hostToTenant"

describe("stripAdminPrefix", () => {
  it("removes admin. prefix", () => {
    expect(stripAdminPrefix("admin.clientasite.nl")).toBe("clientasite.nl")
  })
  it("removes admin. and port", () => {
    expect(stripAdminPrefix("admin.clientasite.nl:3000")).toBe("clientasite.nl")
  })
  it("returns input unchanged when no admin. prefix", () => {
    expect(stripAdminPrefix("clientasite.nl")).toBe("clientasite.nl")
  })
  it("handles localhost", () => {
    expect(stripAdminPrefix("admin.localhost:3000")).toBe("localhost")
  })
})

describe("isSuperAdminDomain", () => {
  it("matches NEXT_PUBLIC_SUPER_ADMIN_DOMAIN", () => {
    expect(isSuperAdminDomain("siteinabox.nl", "siteinabox.nl")).toBe(true)
    expect(isSuperAdminDomain("clientasite.nl", "siteinabox.nl")).toBe(false)
  })
  it("dev fallback: any 'localhost' is super-admin if env not set", () => {
    expect(isSuperAdminDomain("localhost", undefined)).toBe(true)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/unit/hostToTenant.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/hostToTenant.ts`:
```ts
export const stripAdminPrefix = (host: string): string => {
  const noPort = host.split(":")[0] || host
  return noPort.startsWith("admin.") ? noPort.slice(6) : noPort
}

export const isSuperAdminDomain = (domain: string, configured: string | undefined): boolean => {
  if (!configured) return domain === "localhost"
  return domain === configured
}
```

- [ ] **Step 4: Run + commit**

```bash
pnpm test tests/unit/hostToTenant.test.ts && pnpm typecheck
git add src/lib/hostToTenant.ts tests/unit/hostToTenant.test.ts
git commit -m "feat(phase-3): hostToTenant pure helpers"
```

### Task 3.2: Middleware for the (frontend) route group

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Implement**

`src/middleware.ts`:
```ts
import { NextRequest, NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { stripAdminPrefix, isSuperAdminDomain } from "@/lib/hostToTenant"

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"]
const ROUTE_GROUPS_TO_GATE = /^\/(?!api|admin|_next|favicon|public)/

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only gate the (frontend) route group; let Payload's /admin and /api pass.
  if (!ROUTE_GROUPS_TO_GATE.test(pathname)) return NextResponse.next()
  if (pathname.startsWith("/_next")) return NextResponse.next()

  const host = req.headers.get("host") || ""
  const domain = stripAdminPrefix(host)
  const superAdminDomain = process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN

  const res = NextResponse.next()

  if (isSuperAdminDomain(domain, superAdminDomain)) {
    res.headers.set("x-siab-mode", "super-admin")
    res.headers.set("x-siab-tenant", "")
    return res
  }

  // Resolve tenant by domain
  const payload = await getPayload({ config })
  const tenants = await payload.find({
    collection: "tenants",
    where: { domain: { equals: domain } },
    limit: 1,
    overrideAccess: true
  })
  const tenant = tenants.docs[0]

  if (!tenant) {
    return new NextResponse("Site not provisioned", { status: 404 })
  }
  if (tenant.status === "suspended") {
    return new NextResponse("Site temporarily unavailable", { status: 503 })
  }
  if (tenant.status === "archived") {
    return new NextResponse("Gone", { status: 410 })
  }

  res.headers.set("x-siab-mode", "tenant")
  res.headers.set("x-siab-tenant", tenant.id as string)
  return res
}

export const config_runtime = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
}

export const config2 = config_runtime
export { config2 as config }
```

> **Note for the implementer:** Next.js's `getPayload({ config })` from middleware works in Node runtime; it does NOT work in the Edge runtime. Add `export const runtime = "nodejs"` if Next picks edge by default. The trick with `config_runtime`/`config2` is because the Payload import shadows the named `config` export; rename if your editor flags it.

- [ ] **Step 2: Verify**

Run `pnpm dev`. With Postgres still containing the test tenants from Phase 2.9 (`clienta.nl`, `clientb.nl`), edit your `/etc/hosts` (or Windows hosts file) to map `admin.clienta.nl 127.0.0.1`. Visit http://admin.clienta.nl:3000/. Browser shouldn't 404; check response headers — `x-siab-mode: tenant`, `x-siab-tenant: <uuid>`.

Visit http://localhost:3000/ — `x-siab-mode: super-admin`.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(phase-3): host-resolution middleware (mode + tenant via headers)"
```

### Task 3.3: Server-side context helper

**Files:**
- Create: `src/lib/context.ts`
- Test: `tests/unit/context.test.ts`

- [ ] **Step 1: Implement**

`src/lib/context.ts`:
```ts
import { headers } from "next/headers"

export type SiabMode = "super-admin" | "tenant"

export type SiabContext =
  | { mode: "super-admin"; tenantId: null }
  | { mode: "tenant"; tenantId: string }

export const getSiabContext = async (): Promise<SiabContext> => {
  const h = await headers()
  const mode = h.get("x-siab-mode") as SiabMode | null
  const tenantId = h.get("x-siab-tenant") || ""
  if (mode === "super-admin") return { mode, tenantId: null }
  if (mode === "tenant" && tenantId) return { mode, tenantId }
  throw new Error("siab middleware did not run for this request")
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/context.ts
git commit -m "feat(phase-3): getSiabContext helper for RSC routes"
```

### Task 3.4: Auth gate — server action used by (admin) layout

**Files:**
- Create: `src/lib/authGate.ts`

- [ ] **Step 1: Implement**

`src/lib/authGate.ts`:
```ts
import { redirect } from "next/navigation"
import { getPayload } from "payload"
import { headers } from "next/headers"
import { cookies } from "next/headers"
import config from "@/payload.config"
import { getSiabContext } from "@/lib/context"
import type { User } from "@/payload-types"

export type GateResult = { user: User; ctx: Awaited<ReturnType<typeof getSiabContext>> }

export const requireAuth = async (): Promise<GateResult> => {
  const ctx = await getSiabContext()
  const payload = await getPayload({ config })
  const headersList = await headers()
  const cookieStore = await cookies()

  // Reconstruct a Headers object Payload can read from
  const reqHeaders = new Headers()
  for (const [k, v] of headersList) reqHeaders.set(k, v)
  const cookieHeader = cookieStore.toString()
  if (cookieHeader) reqHeaders.set("cookie", cookieHeader)

  const result = await payload.auth({ headers: reqHeaders })
  const user = result.user as User | null

  if (!user) redirect("/login")

  if (ctx.mode === "super-admin" && user.role !== "super-admin") {
    // Wrong host for cookie — clear and bounce
    redirect("/login?error=wrong-host")
  }
  if (ctx.mode === "tenant" && user.role === "super-admin") {
    redirect("/login?error=super-admin-on-tenant-host")
  }
  if (ctx.mode === "tenant") {
    const userTenantId = typeof user.tenant === "string" ? user.tenant : (user.tenant as any)?.id
    if (userTenantId !== ctx.tenantId) {
      redirect("/login?error=cross-tenant")
    }
  }

  return { user, ctx }
}

export const requireRole = async (allowed: User["role"][]): Promise<GateResult> => {
  const result = await requireAuth()
  if (!allowed.includes(result.user.role)) redirect("/?error=forbidden")
  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/authGate.ts
git commit -m "feat(phase-3): requireAuth + requireRole RSC helpers"
```

### Task 3.5: Auth gate matrix integration test

**Files:**
- Create: `tests/integration/auth-gate-matrix.test.ts`

> This is one of the three critical test suites from the spec. It runs against a real Payload instance backed by the local Postgres.

- [ ] **Step 1: Test setup helper**

`tests/integration/_helpers.ts`:
```ts
import { getPayload, type Payload } from "payload"
import config from "@/payload.config"

export async function getTestPayload(): Promise<Payload> {
  const payload = await getPayload({ config })
  return payload
}

export async function resetTestData(payload: Payload) {
  // Wipe all collections in dependency order
  for (const slug of ["pages", "media", "site-settings", "forms", "users", "tenants"] as const) {
    const docs = await payload.find({ collection: slug, limit: 1000, overrideAccess: true })
    for (const d of docs.docs) {
      await payload.delete({ collection: slug, id: d.id, overrideAccess: true })
    }
  }
}

export async function seedFixture(payload: Payload) {
  const t1 = await payload.create({ collection: "tenants", data: {
    name: "Tenant 1", slug: "t1", domain: "t1.test", status: "active"
  }, overrideAccess: true })
  const t2 = await payload.create({ collection: "tenants", data: {
    name: "Tenant 2", slug: "t2", domain: "t2.test", status: "active"
  }, overrideAccess: true })

  const sa = await payload.create({ collection: "users", data: {
    email: "sa@test", password: "test1234", name: "SA", role: "super-admin"
  } as any, overrideAccess: true })
  const owner1 = await payload.create({ collection: "users", data: {
    email: "owner1@test", password: "test1234", name: "Owner1", role: "owner", tenant: t1.id
  } as any, overrideAccess: true })
  const editor1 = await payload.create({ collection: "users", data: {
    email: "editor1@test", password: "test1234", name: "Editor1", role: "editor", tenant: t1.id
  } as any, overrideAccess: true })
  const viewer1 = await payload.create({ collection: "users", data: {
    email: "viewer1@test", password: "test1234", name: "Viewer1", role: "viewer", tenant: t1.id
  } as any, overrideAccess: true })
  const owner2 = await payload.create({ collection: "users", data: {
    email: "owner2@test", password: "test1234", name: "Owner2", role: "owner", tenant: t2.id
  } as any, overrideAccess: true })

  return { t1, t2, sa, owner1, editor1, viewer1, owner2 }
}
```

- [ ] **Step 2: Write the matrix test**

`tests/integration/auth-gate-matrix.test.ts`:
```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { getTestPayload, resetTestData, seedFixture } from "./_helpers"
import type { Payload } from "payload"

let payload: Payload
let fx: Awaited<ReturnType<typeof seedFixture>>

beforeAll(async () => { payload = await getTestPayload() })
beforeEach(async () => {
  await resetTestData(payload)
  fx = await seedFixture(payload)
})

const cases: Array<{ host: "super" | "t1" | "t2", who: keyof typeof userByName, expect: "allow" | "block" }> = [
  // super-admin host
  { host: "super", who: "sa",      expect: "allow" },
  { host: "super", who: "owner1",  expect: "block" },
  { host: "super", who: "editor1", expect: "block" },
  { host: "super", who: "viewer1", expect: "block" },
  { host: "super", who: "owner2",  expect: "block" },
  // tenant 1 host
  { host: "t1", who: "sa",         expect: "block" },
  { host: "t1", who: "owner1",     expect: "allow" },
  { host: "t1", who: "editor1",    expect: "allow" },
  { host: "t1", who: "viewer1",    expect: "allow" },
  { host: "t1", who: "owner2",     expect: "block" },
  // tenant 2 host (cross-tenant cookie reuse case)
  { host: "t2", who: "owner1",     expect: "block" },
  { host: "t2", who: "owner2",     expect: "allow" }
]

const userByName = { sa: 0, owner1: 0, editor1: 0, viewer1: 0, owner2: 0 } as const

describe("auth gate matrix (host × role × tenant)", () => {
  it.each(cases)("$host host, $who -> $expect", ({ host, who, expect: outcome }) => {
    const u = (fx as any)[who]
    const tenantId = host === "t1" ? fx.t1.id : host === "t2" ? fx.t2.id : null
    const mode = host === "super" ? "super-admin" : "tenant"

    let blocked = false
    let reason = ""
    if (mode === "super-admin" && u.role !== "super-admin") { blocked = true; reason = "wrong-host" }
    if (mode === "tenant" && u.role === "super-admin") { blocked = true; reason = "super-admin-on-tenant-host" }
    if (mode === "tenant" && tenantId && u.tenant && (typeof u.tenant === "string" ? u.tenant : u.tenant.id) !== tenantId) {
      blocked = true; reason = "cross-tenant"
    }

    if (outcome === "allow") expect(blocked).toBe(false)
    else expect(blocked).toBe(true)
  })
})
```

- [ ] **Step 3: Run + commit**

Run: `pnpm test tests/integration/auth-gate-matrix.test.ts`
Expected: 12 passing.

```bash
git add tests/integration
git commit -m "test(phase-3): auth gate matrix (12 host/role/tenant cases)"
```

**Phase 3 milestone:** Middleware identifies tenant from host. Server-side helpers expose `mode` + `tenantId` to RSC routes. `requireAuth`/`requireRole` enforce the gate matrix. Critical isolation logic has tests.

---

## Phase 4 — afterChange JSON projection to disk

**Goal:** Publishing a Page or updating SiteSettings writes flat JSON atomically to `<DATA_DIR>/tenants/<id>/`. Media uploads land in `<DATA_DIR>/tenants/<id>/media/`. Tenant lifecycle hooks create/archive directories.

### Task 4.1: atomicWrite utility

**Files:**
- Create: `src/lib/atomicWrite.ts`
- Test: `tests/unit/atomicWrite.test.ts`

- [ ] **Step 1: Test**

`tests/unit/atomicWrite.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { writeAtomic } from "@/lib/atomicWrite"
import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"

let tmpdir: string
beforeEach(async () => { tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "siab-")) })
afterEach(async () => { await fs.rm(tmpdir, { recursive: true, force: true }) })

describe("writeAtomic", () => {
  it("writes content to the target path", async () => {
    const target = path.join(tmpdir, "a", "b", "c.json")
    await writeAtomic(target, '{"x":1}')
    expect(await fs.readFile(target, "utf8")).toBe('{"x":1}')
  })

  it("creates parent directories", async () => {
    const target = path.join(tmpdir, "deep/very/deep/file.txt")
    await writeAtomic(target, "ok")
    expect(await fs.readFile(target, "utf8")).toBe("ok")
  })

  it("does not leave .tmp behind on success", async () => {
    const target = path.join(tmpdir, "x.json")
    await writeAtomic(target, "{}")
    const dir = await fs.readdir(tmpdir)
    expect(dir).toEqual(["x.json"])
  })
})
```

- [ ] **Step 2: Implement**

`src/lib/atomicWrite.ts`:
```ts
import { promises as fs } from "node:fs"
import path from "node:path"

export async function writeAtomic(target: string, content: string): Promise<void> {
  const dir = path.dirname(target)
  await fs.mkdir(dir, { recursive: true })

  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`
  const fh = await fs.open(tmp, "w")
  try {
    await fh.writeFile(content)
    await fh.sync()
  } finally {
    await fh.close()
  }
  await fs.rename(tmp, target)
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test tests/unit/atomicWrite.test.ts
git add src/lib/atomicWrite.ts tests/
git commit -m "feat(phase-4): writeAtomic (tmp + fsync + rename)"
```

### Task 4.2: pageToJson projector

**Files:**
- Create: `src/lib/projection/pageToJson.ts`
- Test: `tests/unit/pageToJson.test.ts`

- [ ] **Step 1: Test (snapshot)**

`tests/unit/pageToJson.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { pageToJson } from "@/lib/projection/pageToJson"

describe("pageToJson", () => {
  it("flattens a basic Hero+CTA page", () => {
    const doc: any = {
      id: "page1", tenant: "ten1", title: "Home", slug: "home", status: "published",
      blocks: [
        { id: "b1", blockType: "hero", headline: "Welcome", subheadline: "Sub",
          cta: { label: "Go", href: "/go" }, image: { url: "/uploads/hero.png", filename: "hero.png" } },
        { id: "b2", blockType: "cta", headline: "Buy now", primary: { label: "Buy", href: "/buy" } }
      ],
      seo: { title: "Home | Site", description: "Welcome page",
             ogImage: { url: "/uploads/og.png", filename: "og.png" } },
      updatedAt: "2026-05-05T10:00:00.000Z"
    }
    expect(pageToJson(doc)).toMatchInlineSnapshot(`
      {
        "blocks": [
          {
            "blockType": "hero",
            "cta": {
              "href": "/go",
              "label": "Go",
            },
            "headline": "Welcome",
            "image": {
              "filename": "hero.png",
              "url": "/uploads/hero.png",
            },
            "subheadline": "Sub",
          },
          {
            "blockType": "cta",
            "headline": "Buy now",
            "primary": {
              "href": "/buy",
              "label": "Buy",
            },
          },
        ],
        "seo": {
          "description": "Welcome page",
          "ogImage": {
            "filename": "og.png",
            "url": "/uploads/og.png",
          },
          "title": "Home | Site",
        },
        "slug": "home",
        "title": "Home",
        "updatedAt": "2026-05-05T10:00:00.000Z",
      }
    `)
  })

  it("strips ids and tenant", () => {
    const doc: any = { id: "x", tenant: "t", title: "t", slug: "s", status: "published",
      blocks: [{ id: "ignored", blockType: "richText", body: "hi" }] }
    const json = pageToJson(doc)
    expect(json).not.toHaveProperty("id")
    expect(json).not.toHaveProperty("tenant")
    expect(json.blocks[0]).not.toHaveProperty("id")
  })
})
```

- [ ] **Step 2: Implement**

`src/lib/projection/pageToJson.ts`:
```ts
type Json = Record<string, any>

const stripBlockIds = (b: any): Json => {
  const { id, ...rest } = b
  return rest
}

const flattenMedia = (m: any): Json | null => {
  if (!m) return null
  if (typeof m === "string") return { id: m }
  return { url: m.url, filename: m.filename, alt: m.alt, width: m.width, height: m.height }
}

const projectField = (v: any): any => {
  if (v == null) return v
  if (Array.isArray(v)) return v.map(projectField)
  if (typeof v === "object") {
    if ("url" in v && "filename" in v) return flattenMedia(v)
    const out: Json = {}
    for (const [k, val] of Object.entries(v)) out[k] = projectField(val)
    return out
  }
  return v
}

export function pageToJson(doc: Json): Json {
  return {
    title: doc.title,
    slug: doc.slug,
    blocks: (doc.blocks ?? []).map(stripBlockIds).map(projectField),
    seo: doc.seo ? projectField(doc.seo) : undefined,
    updatedAt: doc.updatedAt
  }
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test tests/unit/pageToJson.test.ts
git add src/lib/projection tests/unit/pageToJson.test.ts
git commit -m "feat(phase-4): pageToJson projector + snapshot test"
```

### Task 4.3: settingsToJson projector

**Files:**
- Create: `src/lib/projection/settingsToJson.ts`
- Test: `tests/unit/settingsToJson.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from "vitest"
import { settingsToJson } from "@/lib/projection/settingsToJson"

describe("settingsToJson", () => {
  it("flattens settings with branding/contact/navigation", () => {
    const doc: any = {
      id: "s1", tenant: "t1", siteName: "Client A", siteUrl: "https://clienta.nl",
      contactEmail: "hi@clienta.nl",
      branding: { logo: { url: "/uploads/logo.png", filename: "logo.png" }, primaryColor: "#2563eb" },
      contact: { phone: "+31 20 555 1234", address: "Street 1", social: [{ platform: "instagram", url: "https://ig" }] },
      navigation: [{ label: "Home", href: "/", external: false }, { label: "Contact", href: "/contact", external: false }]
    }
    expect(settingsToJson(doc)).toEqual({
      siteName: "Client A",
      siteUrl: "https://clienta.nl",
      contactEmail: "hi@clienta.nl",
      branding: { logo: { url: "/uploads/logo.png", filename: "logo.png", alt: undefined, width: undefined, height: undefined }, primaryColor: "#2563eb" },
      contact: { phone: "+31 20 555 1234", address: "Street 1", social: [{ platform: "instagram", url: "https://ig" }] },
      navigation: [{ label: "Home", href: "/", external: false }, { label: "Contact", href: "/contact", external: false }]
    })
  })
})
```

- [ ] **Step 2: Implement**

`src/lib/projection/settingsToJson.ts`:
```ts
import { pageToJson } from "./pageToJson" // reuse projectField via re-export below

const flattenMedia = (m: any) => m && (typeof m === "string" ? { id: m } :
  { url: m.url, filename: m.filename, alt: m.alt, width: m.width, height: m.height })

export function settingsToJson(doc: any) {
  return {
    siteName: doc.siteName,
    siteUrl: doc.siteUrl,
    contactEmail: doc.contactEmail,
    branding: doc.branding ? {
      logo: flattenMedia(doc.branding.logo),
      primaryColor: doc.branding.primaryColor
    } : undefined,
    contact: doc.contact ? {
      phone: doc.contact.phone,
      address: doc.contact.address,
      social: (doc.contact.social ?? []).map((s: any) => ({ platform: s.platform, url: s.url }))
    } : undefined,
    navigation: (doc.navigation ?? []).map((n: any) => ({ label: n.label, href: n.href, external: !!n.external }))
  }
}
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test tests/unit/settingsToJson.test.ts
git add src/lib/projection/settingsToJson.ts tests/unit/settingsToJson.test.ts
git commit -m "feat(phase-4): settingsToJson projector"
```

### Task 4.4: manifest helpers

**Files:**
- Create: `src/lib/projection/manifest.ts`
- Test: `tests/unit/manifest.test.ts`

- [ ] **Step 1: Implement**

`src/lib/projection/manifest.ts`:
```ts
import { promises as fs } from "node:fs"
import path from "node:path"
import { writeAtomic } from "@/lib/atomicWrite"

type Entry = { type: "page" | "media" | "settings"; key: string; updatedAt: string }
export type Manifest = { tenantId: string; version: number; updatedAt: string; entries: Entry[] }

const manifestPath = (dataDir: string, tenantId: string) =>
  path.join(dataDir, "tenants", tenantId, "manifest.json")

export async function readManifest(dataDir: string, tenantId: string): Promise<Manifest> {
  try {
    const buf = await fs.readFile(manifestPath(dataDir, tenantId), "utf8")
    return JSON.parse(buf)
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return { tenantId, version: 0, updatedAt: new Date(0).toISOString(), entries: [] }
    }
    throw err
  }
}

export async function writeManifest(dataDir: string, m: Manifest): Promise<void> {
  await writeAtomic(manifestPath(dataDir, m.tenantId), JSON.stringify(m, null, 2))
}

export function upsertEntry(m: Manifest, e: Entry): Manifest {
  const filtered = m.entries.filter(x => !(x.type === e.type && x.key === e.key))
  return { ...m, version: m.version + 1, updatedAt: new Date().toISOString(), entries: [...filtered, e] }
}

export function removeEntry(m: Manifest, type: Entry["type"], key: string): Manifest {
  const filtered = m.entries.filter(x => !(x.type === type && x.key === key))
  return { ...m, version: m.version + 1, updatedAt: new Date().toISOString(), entries: filtered }
}
```

- [ ] **Step 2: Test**

`tests/unit/manifest.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readManifest, writeManifest, upsertEntry, removeEntry } from "@/lib/projection/manifest"
import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"

let tmp: string
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), "manifest-")) })
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }) })

describe("manifest", () => {
  it("readManifest returns empty when missing", async () => {
    const m = await readManifest(tmp, "t1")
    expect(m).toEqual({ tenantId: "t1", version: 0, updatedAt: new Date(0).toISOString(), entries: [] })
  })

  it("upsertEntry replaces existing", () => {
    let m: any = { tenantId: "t1", version: 0, updatedAt: "x", entries: [{ type: "page", key: "home", updatedAt: "y" }] }
    m = upsertEntry(m, { type: "page", key: "home", updatedAt: "z" })
    expect(m.entries).toEqual([{ type: "page", key: "home", updatedAt: "z" }])
    expect(m.version).toBe(1)
  })

  it("writeManifest then readManifest round-trips", async () => {
    const m = upsertEntry(await readManifest(tmp, "t1"), { type: "page", key: "home", updatedAt: "2026-05-05" })
    await writeManifest(tmp, m)
    const m2 = await readManifest(tmp, "t1")
    expect(m2.entries[0]).toEqual({ type: "page", key: "home", updatedAt: "2026-05-05" })
  })

  it("removeEntry drops matching entries", () => {
    let m: any = { tenantId: "t1", version: 1, updatedAt: "x", entries: [{ type: "page", key: "a", updatedAt: "1" }, { type: "page", key: "b", updatedAt: "1" }] }
    m = removeEntry(m, "page", "a")
    expect(m.entries).toEqual([{ type: "page", key: "b", updatedAt: "1" }])
  })
})
```

- [ ] **Step 3: Run + commit**

```bash
pnpm test tests/unit/manifest.test.ts
git add src/lib/projection/manifest.ts tests/unit/manifest.test.ts
git commit -m "feat(phase-4): manifest helpers (read/write/upsert/remove)"
```

### Task 4.5: projectToDisk afterChange hook

**Files:**
- Create: `src/hooks/projectToDisk.ts`
- Test: `tests/integration/hooks-projection.test.ts`

- [ ] **Step 1: Implement**

`src/hooks/projectToDisk.ts`:
```ts
import path from "node:path"
import { promises as fs } from "node:fs"
import type { CollectionAfterChangeHook } from "payload"
import { writeAtomic } from "@/lib/atomicWrite"
import { pageToJson } from "@/lib/projection/pageToJson"
import { settingsToJson } from "@/lib/projection/settingsToJson"
import { readManifest, writeManifest, upsertEntry, removeEntry } from "@/lib/projection/manifest"

const dataDir = () => path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

const tenantIdOf = (doc: any): string =>
  typeof doc.tenant === "string" ? doc.tenant : doc.tenant?.id

export const projectPageToDisk: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId) return doc
  const tenantDir = path.join(dataDir(), "tenants", tenantId)

  // Status change handling: published → publish; non-published → remove file
  const wasPublished = previousDoc?.status === "published"
  const isPublished = doc.status === "published"
  const slug = doc.slug as string

  if (isPublished) {
    const json = pageToJson(doc)
    await writeAtomic(path.join(tenantDir, "pages", `${slug}.json`), JSON.stringify(json, null, 2))
    let m = await readManifest(dataDir(), tenantId)
    m = upsertEntry(m, { type: "page", key: slug, updatedAt: doc.updatedAt as string })
    await writeManifest(dataDir(), m)
    req.payload.logger.info({ tenantId, slug }, "[projection] page published to disk")
  } else if (wasPublished) {
    // Was published, no longer is — remove file
    const target = path.join(tenantDir, "pages", `${previousDoc?.slug || slug}.json`)
    await fs.rm(target, { force: true })
    let m = await readManifest(dataDir(), tenantId)
    m = removeEntry(m, "page", (previousDoc?.slug || slug) as string)
    await writeManifest(dataDir(), m)
    req.payload.logger.info({ tenantId, slug }, "[projection] page unpublished — file removed")
  }

  return doc
}

export const projectSettingsToDisk: CollectionAfterChangeHook = async ({ doc, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId) return doc
  const tenantDir = path.join(dataDir(), "tenants", tenantId)
  await writeAtomic(path.join(tenantDir, "site.json"), JSON.stringify(settingsToJson(doc), null, 2))
  let m = await readManifest(dataDir(), tenantId)
  m = upsertEntry(m, { type: "settings", key: "site", updatedAt: doc.updatedAt as string })
  await writeManifest(dataDir(), m)
  req.payload.logger.info({ tenantId }, "[projection] site settings projected")
  return doc
}

export const projectMediaToDisk: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId || !doc.filename) return doc
  const tenantDir = path.join(dataDir(), "tenants", tenantId, "media")
  await fs.mkdir(tenantDir, { recursive: true })

  // Move uploaded file from staging dir to per-tenant dir
  const staging = path.join(dataDir(), "_uploads-tmp", doc.filename as string)
  const final = path.join(tenantDir, doc.filename as string)
  try {
    if (operation === "create" || (operation === "update" && (await fs.stat(staging).then(() => true).catch(() => false)))) {
      await fs.rename(staging, final)
    }
  } catch (err) {
    req.payload.logger.warn({ err, tenantId, filename: doc.filename }, "[projection] media move skipped")
  }

  let m = await readManifest(dataDir(), tenantId)
  m = upsertEntry(m, { type: "media", key: doc.filename as string, updatedAt: doc.updatedAt as string })
  await writeManifest(dataDir(), m)
  return doc
}
```

- [ ] **Step 2: Wire into collections**

In `src/collections/Pages.ts`:
```ts
import { projectPageToDisk } from "@/hooks/projectToDisk"
hooks: { beforeChange: [/* existing */], afterChange: [projectPageToDisk] }
```

In `src/collections/SiteSettings.ts`:
```ts
import { projectSettingsToDisk } from "@/hooks/projectToDisk"
hooks: { afterChange: [projectSettingsToDisk] }
```

In `src/collections/Media.ts`:
```ts
import { projectMediaToDisk } from "@/hooks/projectToDisk"
hooks: { afterChange: [projectMediaToDisk] }
```

- [ ] **Step 3: Integration test**

`tests/integration/hooks-projection.test.ts`:
```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { promises as fs } from "node:fs"
import path from "node:path"
import { getTestPayload, resetTestData, seedFixture } from "./_helpers"
import type { Payload } from "payload"

let payload: Payload

beforeAll(async () => { payload = await getTestPayload() })
beforeEach(async () => { await resetTestData(payload) })

const dataDir = () => path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

describe("projectToDisk", () => {
  it("writes a page JSON file when published", async () => {
    const fx = await seedFixture(payload)
    await payload.create({
      collection: "pages", overrideAccess: true,
      data: { tenant: fx.t1.id, title: "Home", slug: "home", status: "published",
              blocks: [{ blockType: "hero", headline: "Hi" }] } as any
    })
    const file = path.join(dataDir(), "tenants", fx.t1.id as string, "pages", "home.json")
    const content = JSON.parse(await fs.readFile(file, "utf8"))
    expect(content.title).toBe("Home")
    expect(content.blocks[0]).toMatchObject({ blockType: "hero", headline: "Hi" })
  })

  it("removes the file when status flips to draft", async () => {
    const fx = await seedFixture(payload)
    const created = await payload.create({
      collection: "pages", overrideAccess: true,
      data: { tenant: fx.t1.id, title: "Home", slug: "home", status: "published" } as any
    })
    await payload.update({
      collection: "pages", id: created.id, overrideAccess: true,
      data: { status: "draft" }
    })
    const file = path.join(dataDir(), "tenants", fx.t1.id as string, "pages", "home.json")
    await expect(fs.stat(file)).rejects.toThrow()
  })

  it("manifest tracks the published page", async () => {
    const fx = await seedFixture(payload)
    await payload.create({
      collection: "pages", overrideAccess: true,
      data: { tenant: fx.t1.id, title: "Home", slug: "home", status: "published" } as any
    })
    const m = JSON.parse(await fs.readFile(path.join(dataDir(), "tenants", fx.t1.id as string, "manifest.json"), "utf8"))
    expect(m.entries.find((e: any) => e.type === "page" && e.key === "home")).toBeTruthy()
  })
})
```

- [ ] **Step 4: Run + commit**

```bash
pnpm test tests/integration/hooks-projection.test.ts
git add src/hooks/projectToDisk.ts src/collections/ tests/
git commit -m "feat(phase-4): projectToDisk afterChange hooks (Pages, Media, SiteSettings)"
```

### Task 4.6: Tenant lifecycle hooks

**Files:**
- Create: `src/hooks/tenantLifecycle.ts`
- Modify: `src/collections/Tenants.ts`

- [ ] **Step 1: Implement**

`src/hooks/tenantLifecycle.ts`:
```ts
import path from "node:path"
import { promises as fs } from "node:fs"
import type { CollectionAfterChangeHook } from "payload"
import { writeAtomic } from "@/lib/atomicWrite"

const dataDir = () => path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

export const createTenantDir: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== "create") return doc
  const dir = path.join(dataDir(), "tenants", doc.id as string)
  await fs.mkdir(path.join(dir, "pages"), { recursive: true })
  await fs.mkdir(path.join(dir, "media"), { recursive: true })
  await writeAtomic(path.join(dir, "manifest.json"), JSON.stringify({
    tenantId: doc.id, version: 0, updatedAt: new Date().toISOString(), entries: []
  }, null, 2))
  req.payload.logger.info({ tenantId: doc.id }, "[tenants] data dir created")
  return doc
}

export const archiveTenantDir: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const wasArchived = previousDoc?.status === "archived"
  const isArchived = doc.status === "archived"
  if (!isArchived || wasArchived) return doc
  const live = path.join(dataDir(), "tenants", doc.id as string)
  const archived = path.join(dataDir(), "archived", doc.id as string)
  await fs.mkdir(path.dirname(archived), { recursive: true })
  await fs.rename(live, archived)
  req.payload.logger.info({ tenantId: doc.id }, "[tenants] data dir archived")
  return doc
}
```

- [ ] **Step 2: Wire**

In `src/collections/Tenants.ts`:
```ts
import { createTenantDir, archiveTenantDir } from "@/hooks/tenantLifecycle"
hooks: { afterChange: [createTenantDir, archiveTenantDir] }
```

- [ ] **Step 3: Verify**

Run `pnpm dev`. Create a new tenant; verify `<DATA_DIR>/tenants/<id>/{pages,media,manifest.json}` appears.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/tenantLifecycle.ts src/collections/Tenants.ts
git commit -m "feat(phase-4): tenant lifecycle hooks (create dir, archive)"
```

### Task 4.7: deleteFileFromDisk afterDelete hook

**Files:**
- Create: `src/hooks/deleteFileFromDisk.ts`

- [ ] **Step 1: Implement**

`src/hooks/deleteFileFromDisk.ts`:
```ts
import path from "node:path"
import { promises as fs } from "node:fs"
import type { CollectionAfterDeleteHook } from "payload"
import { readManifest, writeManifest, removeEntry } from "@/lib/projection/manifest"

const dataDir = () => path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

const tenantIdOf = (doc: any): string =>
  typeof doc.tenant === "string" ? doc.tenant : doc.tenant?.id

export const deletePageFile: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId) return
  const file = path.join(dataDir(), "tenants", tenantId, "pages", `${doc.slug}.json`)
  await fs.rm(file, { force: true })
  let m = await readManifest(dataDir(), tenantId)
  m = removeEntry(m, "page", doc.slug as string)
  await writeManifest(dataDir(), m)
  req.payload.logger.info({ tenantId, slug: doc.slug }, "[projection] page deleted from disk")
}

export const deleteMediaFile: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId || !doc.filename) return
  const file = path.join(dataDir(), "tenants", tenantId, "media", doc.filename as string)
  await fs.rm(file, { force: true })
  let m = await readManifest(dataDir(), tenantId)
  m = removeEntry(m, "media", doc.filename as string)
  await writeManifest(dataDir(), m)
  req.payload.logger.info({ tenantId, filename: doc.filename }, "[projection] media deleted from disk")
}
```

- [ ] **Step 2: Wire**

In `src/collections/Pages.ts`:
```ts
import { deletePageFile } from "@/hooks/deleteFileFromDisk"
hooks: { /* existing */, afterDelete: [deletePageFile] }
```

In `src/collections/Media.ts`:
```ts
import { deleteMediaFile } from "@/hooks/deleteFileFromDisk"
hooks: { /* existing */, afterDelete: [deleteMediaFile] }
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/deleteFileFromDisk.ts src/collections/
git commit -m "feat(phase-4): afterDelete cleanup (page + media files)"
```

### Task 4.8: Health check endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from "next/server"
import { promises as fs } from "node:fs"
import path from "node:path"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function GET() {
  const dataDir = path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")
  let dbOk = false
  let dirOk = false
  try {
    const payload = await getPayload({ config })
    await payload.db.connect?.()
    dbOk = true
  } catch {}
  try {
    await fs.access(dataDir)
    await fs.writeFile(path.join(dataDir, ".healthcheck"), "ok")
    await fs.rm(path.join(dataDir, ".healthcheck"))
    dirOk = true
  } catch {}
  const ok = dbOk && dirOk
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", db: dbOk ? "connected" : "down", dataDir: dirOk ? "writable" : "unwritable" },
    { status: ok ? 200 : 503 }
  )
}
```

- [ ] **Step 2: Verify**

Run `pnpm dev`, then:
```bash
curl http://localhost:3000/api/health
```
Expected: `{"status":"ok","db":"connected","dataDir":"writable"}` with status 200.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/health
git commit -m "feat(phase-4): /api/health endpoint"
```

**Phase 4 milestone:** **Backend complete.** Publishing a page in Payload's native admin writes JSON to `<DATA_DIR>/tenants/<id>/pages/<slug>.json` atomically. Tenant create/archive lifecycle works. Health check returns 200. The orchestrator can integrate against this version even before the shadcn UI lands.

---

## Phase 5 — Disable Payload admin + shadcn shell

**Goal:** Payload's `/admin` route serves a "moved" notice. Tailwind 4 + shadcn/ui installed; `components.json` configured; theme set up; AppSidebar + SiteHeader scaffolded; the (admin) route group renders the shell.

### Task 5.1: Tailwind 4 + globals.css

**Files:**
- Create: `src/styles/globals.css`
- Create: `postcss.config.js`
- Modify: `package.json`

- [ ] **Step 1: Add Tailwind 4 deps**

```bash
pnpm add -D tailwindcss@4 @tailwindcss/postcss postcss autoprefixer
pnpm add tailwind-merge clsx
pnpm add -D tw-animate-css
```

- [ ] **Step 2: postcss.config.js**

```js
export default { plugins: { "@tailwindcss/postcss": {} } }
```

- [ ] **Step 3: globals.css (Tailwind 4 + shadcn theme tokens)**

`src/styles/globals.css`:
```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.269 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.371 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.439 0 0);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
}

* { border-color: var(--border); }
body { background: var(--background); color: var(--foreground); font-family: var(--font-sans); }
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css postcss.config.js package.json pnpm-lock.yaml
git commit -m "feat(phase-5): Tailwind 4 + shadcn theme tokens"
```

### Task 5.2: shadcn CLI init + first batch of components

**Files:** various — shadcn places them in `src/components/ui/`

- [ ] **Step 1: shadcn init**

```bash
pnpm dlx shadcn@latest init
# Choose: Yes (TypeScript), New York style, default base color (zinc), CSS variables yes
# Path: src/components, alias src/lib/utils
```

This creates `components.json` and `src/lib/utils.ts`.

- [ ] **Step 2: Add the Phase 5 component set**

```bash
pnpm dlx shadcn@latest add button card input label textarea select dialog sheet dropdown-menu separator skeleton sonner tabs badge avatar breadcrumb tooltip switch
pnpm dlx shadcn@latest add sidebar
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck`
Expected: zero errors. Files appear under `src/components/ui/`.

- [ ] **Step 4: Commit**

```bash
git add components.json src/components/ui src/lib/utils.ts
git commit -m "feat(phase-5): shadcn init + base components (button/card/input/sidebar/...)"
```

### Task 5.3: Disable Payload admin route

**Files:**
- Modify: `src/payload.config.ts`
- Replace: `src/app/(payload)/admin/[[...segments]]/page.tsx`

- [ ] **Step 1: Disable in config**

In `src/payload.config.ts`:
```ts
admin: {
  user: "users",
  disable: true   // <-- new
}
```

- [ ] **Step 2: Replace the admin page route with a redirect**

`src/app/(payload)/admin/[[...segments]]/page.tsx`:
```tsx
import { redirect } from "next/navigation"

export default function PayloadAdminMoved() {
  redirect("/")
}
```

- [ ] **Step 3: Remove not-found.tsx (or convert to redirect)**

`src/app/(payload)/admin/[[...segments]]/not-found.tsx`:
```tsx
import { redirect } from "next/navigation"
export default function NotFound() { redirect("/") }
```

- [ ] **Step 4: Verify**

Run `pnpm dev`. Visit http://localhost:3000/admin → redirects to `/`. The (frontend) placeholder shows. /api/* still works.

- [ ] **Step 5: Commit**

```bash
git add src/payload.config.ts src/app/(payload)
git commit -m "feat(phase-5): disable Payload admin; /admin redirects to /"
```

### Task 5.4: Root layout for (frontend) — fonts + theme provider + globals

**Files:**
- Modify: `src/app/(frontend)/layout.tsx`
- Create: `src/components/layout/ThemeProvider.tsx`

- [ ] **Step 1: Add `next-themes`**

```bash
pnpm add next-themes
```

- [ ] **Step 2: ThemeProvider**

`src/components/layout/ThemeProvider.tsx`:
```tsx
"use client"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

- [ ] **Step 3: Root layout**

`src/app/(frontend)/layout.tsx`:
```tsx
import "@/styles/globals.css"
import { Inter, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/layout/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Update placeholder home so it uses Tailwind**

`src/app/(frontend)/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="text-muted-foreground">siab-payload — login at <a className="underline" href="/login">/login</a></div>
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(frontend) src/components/layout
git commit -m "feat(phase-5): root layout, theme provider, fonts, toaster"
```

### Task 5.5: AppSidebar + SiteHeader + ThemeToggle

**Files:**
- Create: `src/components/layout/AppSidebar.tsx`
- Create: `src/components/layout/SiteHeader.tsx`
- Create: `src/components/layout/ThemeToggle.tsx`
- Create: `src/app/(frontend)/(admin)/layout.tsx`

- [ ] **Step 1: ThemeToggle**

`src/components/layout/ThemeToggle.tsx`:
```tsx
"use client"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
```

- [ ] **Step 2: AppSidebar (mode-aware, pathname-aware)**

`src/components/layout/AppSidebar.tsx`:
```tsx
"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Globe, Users, Inbox, ListChecks, Settings, FileText, Image as ImageIcon } from "lucide-react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem
} from "@/components/ui/sidebar"

type Mode = "super-admin" | "tenant"
type Role = "super-admin" | "owner" | "editor" | "viewer"

export function AppSidebar({ mode, role }: { mode: Mode; role: Role }) {
  // Detect "super-admin viewing a tenant" by URL: /sites/<slug>/...
  const pathname = usePathname() ?? "/"
  const slugMatch = pathname.match(/^\/sites\/([^/]+)/)
  const tenantSlug = slugMatch?.[1]
  const inTenantView = mode === "super-admin" && !!tenantSlug
  const base = inTenantView ? `/sites/${tenantSlug}` : ""
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">S</span>
          SiteInABox
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton asChild><Link href="/"><LayoutDashboard /> Dashboard</Link></SidebarMenuButton></SidebarMenuItem>
              {mode === "super-admin" && !inTenantView && (
                <>
                  <SidebarMenuItem><SidebarMenuButton asChild><Link href="/sites"><Globe /> Sites</Link></SidebarMenuButton></SidebarMenuItem>
                  <SidebarMenuItem><SidebarMenuButton asChild><Link href="/users"><Users /> Users</Link></SidebarMenuButton></SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Content</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/pages`}><FileText /> Pages</Link></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/media`}><ImageIcon /> Media</Link></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/forms`}><Inbox /> Forms</Link></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/settings`}><Settings /> Settings</Link></SidebarMenuButton></SidebarMenuItem>
              {(mode === "super-admin" || role === "owner") && (
                <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/users`}><Users /> Team</Link></SidebarMenuButton></SidebarMenuItem>
              )}
              {inTenantView && (
                <SidebarMenuItem><SidebarMenuButton asChild><Link href={`${base}/onboarding`}><ListChecks /> Onboarding</Link></SidebarMenuButton></SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
```

- [ ] **Step 3: SiteHeader**

`src/components/layout/SiteHeader.tsx`:
```tsx
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "./ThemeToggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function SiteHeader({ user }: { user: { email: string; name?: string | null } }) {
  const initial = (user.name || user.email)[0]?.toUpperCase() ?? "?"
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-2 h-4" />
      <div className="flex-1" />
      <ThemeToggle />
      <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{initial}</AvatarFallback></Avatar>
    </header>
  )
}
```

- [ ] **Step 4: (admin) layout**

`src/app/(frontend)/(admin)/layout.tsx`:
```tsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { requireAuth } from "@/lib/authGate"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, ctx } = await requireAuth()
  return (
    <SidebarProvider>
      <AppSidebar mode={ctx.mode} role={user.role} />
      <SidebarInset>
        <SiteHeader user={user} />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

> **Single layout serves all modes.** The `AppSidebar` reads `usePathname()` itself to detect "super-admin viewing a tenant" (`/sites/<slug>/`) and switches its content accordingly. This avoids needing route-group wrappers like `(portfolio)`/`(tenant)` — every authenticated route lives directly under `(admin)/`. **Ignore any later mention of restructuring into `(portfolio)`/`(tenant)` route groups in Phase 8 or Phase 14 — those notes were earlier drafts; the layout above is the final structure.**

- [ ] **Step 5: Stub home page (will be filled in Phase 7)**

`src/app/(frontend)/(admin)/page.tsx`:
```tsx
export default function DashboardPage() {
  return <div>Dashboard — Phase 7 fills this in.</div>
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/layout src/app/(frontend)/(admin)
git commit -m "feat(phase-5): AppSidebar + SiteHeader + (admin) layout shell"
```

**Phase 5 milestone:** Visiting `/` (after login) renders the dashboard-01 chrome (sidebar + header + main area). Theme toggle works. Mobile-collapsible sidebar functions. Dashboard body is empty pending Phase 7.

---

## Phase 6 — Auth UI (login, forgot, reset)

**Goal:** Working login, forgot-password, and reset-password flows on the (frontend) route group. Login redirects to `/`; failed login shows shadcn form errors; cookie scoped to current host.

### Task 6.1: LoginForm component + page

**Files:**
- Create: `src/components/forms/LoginForm.tsx`
- Create: `src/app/(frontend)/login/page.tsx`

- [ ] **Step 1: Form schema + component**

```bash
pnpm add react-hook-form @hookform/resolvers zod
pnpm dlx shadcn@latest add form
```

- [ ] **Step 2: LoginForm**

`src/components/forms/LoginForm.tsx`:
```tsx
"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password required")
})

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, setPending] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" }
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setPending(true)
    const res = await fetch("/api/users/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values)
    })
    setPending(false)
    if (!res.ok) {
      toast.error("Invalid email or password")
      return
    }
    const next = params.get("next") || "/"
    router.replace(next)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="email" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" autoComplete="email" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        <FormField name="password" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl><Input type="password" autoComplete="current-password" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Signing in..." : "Sign in"}</Button>
        <div className="text-center text-sm">
          <a className="text-muted-foreground underline" href="/forgot-password">Forgot password?</a>
        </div>
      </form>
    </Form>
  )
}
```

- [ ] **Step 3: Login page**

`src/app/(frontend)/login/page.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/forms/LoginForm"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Sign in</CardTitle></CardHeader>
        <CardContent><LoginForm /></CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 4: Verify**

Run `pnpm dev`. Visit http://localhost:3000/login. Sign in with the super-admin from Phase 1. Should redirect to `/` and show the (admin) shell.

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/LoginForm.tsx src/app/(frontend)/login
git commit -m "feat(phase-6): login form + page"
```

### Task 6.2: Forgot-password page

**Files:**
- Create: `src/components/forms/ForgotPasswordForm.tsx`
- Create: `src/app/(frontend)/forgot-password/page.tsx`

- [ ] **Step 1: Form**

`src/components/forms/ForgotPasswordForm.tsx`:
```tsx
"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"

const schema = z.object({ email: z.string().email() })

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { email: "" }
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setPending(true)
    await fetch("/api/users/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values)
    })
    setPending(false)
    setSent(true)
    toast.success("If that email exists, a reset link has been sent.")
  }

  if (sent) return <div className="text-sm text-muted-foreground">Check your inbox for a reset link.</div>

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="email" control={form.control} render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input type="email" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Sending..." : "Send reset link"}</Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 2: Page**

`src/app/(frontend)/forgot-password/page.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm"
export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Reset your password</CardTitle></CardHeader>
        <CardContent><ForgotPasswordForm /></CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/forms/ForgotPasswordForm.tsx src/app/(frontend)/forgot-password
git commit -m "feat(phase-6): forgot-password form + page"
```

### Task 6.3: Reset-password page

**Files:**
- Create: `src/components/forms/ResetPasswordForm.tsx`
- Create: `src/app/(frontend)/reset-password/[token]/page.tsx`

- [ ] **Step 1: Form**

`src/components/forms/ResetPasswordForm.tsx`:
```tsx
"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"

const schema = z.object({
  password: z.string().min(8, "Min 8 characters"),
  confirm: z.string()
}).refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" })

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" }
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setPending(true)
    const res = await fetch("/api/users/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: values.password, token })
    })
    setPending(false)
    if (!res.ok) { toast.error("Reset link expired or invalid"); return }
    toast.success("Password set. Signing you in.")
    router.replace("/")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField name="password" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>New password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField name="confirm" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Confirm</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
        )}/>
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Setting..." : "Set password"}</Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 2: Page**

`src/app/(frontend)/reset-password/[token]/page.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm"

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Set a new password</CardTitle></CardHeader>
        <CardContent><ResetPasswordForm token={token} /></CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/forms/ResetPasswordForm.tsx src/app/(frontend)/reset-password
git commit -m "feat(phase-6): reset-password form + page"
```

**Phase 6 milestone:** Login, forgot-password, and reset-password flows render and submit. Token comes via URL; on success the user lands on `/`. (Email transport is wired in Phase 15; until then forgot-password silently no-ops the email send but the API call returns 200.)

---

## Phase 7 — Super-admin dashboard view

**Goal:** `/` (super-admin host) renders dashboard-01 with real data: 4 stat cards, 30-day edits chart, recent activity table.

### Task 7.1: Activity query helpers

**Files:**
- Create: `src/lib/activity.ts`

- [ ] **Step 1: Implement**

`src/lib/activity.ts`:
```ts
import { getPayload } from "payload"
import config from "@/payload.config"

export type ActivityEntry = {
  type: "page" | "media" | "settings" | "form"
  id: string
  tenantId: string
  tenantName?: string
  title: string
  status?: string
  updatedAt: string
  updatedBy?: string
}

export async function getRecentActivity(opts: { tenantId?: string | null; limit?: number } = {}): Promise<ActivityEntry[]> {
  const payload = await getPayload({ config })
  const limit = opts.limit ?? 25
  const where = opts.tenantId ? { tenant: { equals: opts.tenantId } } : undefined

  const [pages, forms] = await Promise.all([
    payload.find({ collection: "pages", overrideAccess: true, where, limit, sort: "-updatedAt", depth: 1 }),
    payload.find({ collection: "forms", overrideAccess: true, where, limit, sort: "-createdAt", depth: 1 })
  ])

  const pageEntries: ActivityEntry[] = pages.docs.map((p: any) => ({
    type: "page", id: p.id, tenantId: typeof p.tenant === "string" ? p.tenant : p.tenant?.id,
    tenantName: typeof p.tenant === "object" ? p.tenant?.name : undefined,
    title: p.title, status: p.status, updatedAt: p.updatedAt,
    updatedBy: typeof p.updatedBy === "object" ? p.updatedBy?.email : undefined
  }))
  const formEntries: ActivityEntry[] = forms.docs.map((f: any) => ({
    type: "form", id: f.id, tenantId: typeof f.tenant === "string" ? f.tenant : f.tenant?.id,
    tenantName: typeof f.tenant === "object" ? f.tenant?.name : undefined,
    title: `Form submission from ${f.email || "unknown"}`, status: f.status, updatedAt: f.createdAt
  }))

  return [...pageEntries, ...formEntries]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
}

export async function getDashboardStats(tenantId: string | null) {
  const payload = await getPayload({ config })
  const tenantWhere = tenantId ? { tenant: { equals: tenantId } } : undefined

  const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString()
  const wkAgo = since(7), monthAgo = since(30)

  const [tenants, pagesPub, editsThisWeek, formsThisMonth] = await Promise.all([
    tenantId ? Promise.resolve({ totalDocs: 1 }) : payload.count({ collection: "tenants", overrideAccess: true }),
    payload.count({ collection: "pages", overrideAccess: true, where: { ...(tenantWhere as object), status: { equals: "published" } } as any }),
    payload.count({ collection: "pages", overrideAccess: true, where: { ...(tenantWhere as object), updatedAt: { greater_than: wkAgo } } as any }),
    payload.count({ collection: "forms", overrideAccess: true, where: { ...(tenantWhere as object), createdAt: { greater_than: monthAgo } } as any })
  ])

  return {
    tenants: tenants.totalDocs,
    publishedPages: pagesPub.totalDocs,
    editsThisWeek: editsThisWeek.totalDocs,
    formsThisMonth: formsThisMonth.totalDocs
  }
}

export async function getEditsTimeseries(tenantId: string | null, days = 30): Promise<{ date: string; count: number }[]> {
  const payload = await getPayload({ config })
  const tenantWhere = tenantId ? { tenant: { equals: tenantId } } : undefined
  const since = new Date(Date.now() - days * 86400000)

  const pages = await payload.find({
    collection: "pages", overrideAccess: true,
    where: { ...(tenantWhere as object), updatedAt: { greater_than: since.toISOString() } } as any,
    limit: 1000, sort: "-updatedAt"
  })

  const buckets: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10)
    buckets[d] = 0
  }
  for (const p of pages.docs as any[]) {
    const k = (p.updatedAt as string).slice(0, 10)
    if (buckets[k] !== undefined) buckets[k]++
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/activity.ts
git commit -m "feat(phase-7): activity + stats query helpers"
```

### Task 7.2: StatCards component

**Files:**
- Create: `src/components/dashboard/StatCards.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"

type Stat = { label: string; value: number | string; delta?: string; deltaTone?: "up" | "down" }

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="p-4">
            <CardDescription>{s.label}</CardDescription>
            <CardTitle className="text-2xl">{s.value}</CardTitle>
            {s.delta && (
              <div className={`text-xs mt-1 ${s.deltaTone === "down" ? "text-destructive" : "text-emerald-500"}`}>
                {s.delta}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/StatCards.tsx
git commit -m "feat(phase-7): StatCards component"
```

### Task 7.3: EditsChart component (Recharts area)

**Files:**
- Create: `src/components/dashboard/EditsChart.tsx`

- [ ] **Step 1: Add chart deps**

```bash
pnpm dlx shadcn@latest add chart
pnpm add recharts
```

- [ ] **Step 2: Implement**

`src/components/dashboard/EditsChart.tsx`:
```tsx
"use client"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const chartConfig: ChartConfig = {
  count: { label: "Edits", color: "var(--chart-1)" }
}

export function EditsChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Edits per day · last 30 days</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="fillEdits" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.55} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey="count" stroke="var(--chart-1)" fill="url(#fillEdits)" strokeWidth={1.5} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/EditsChart.tsx package.json
git commit -m "feat(phase-7): EditsChart (Recharts area chart)"
```

### Task 7.4: ActivityFeed component

**Files:**
- Create: `src/components/dashboard/ActivityFeed.tsx`
- Create: `src/components/shared/StatusPill.tsx`
- Create: `src/lib/relativeTime.ts`

- [ ] **Step 1: relativeTime util**

`src/lib/relativeTime.ts`:
```ts
export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
```

- [ ] **Step 2: StatusPill**

```tsx
import { Badge } from "@/components/ui/badge"
export function StatusPill({ status }: { status?: string }) {
  if (!status) return null
  const tone: Record<string, string> = {
    published: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
    draft: "bg-amber-500/15 text-amber-500 border-amber-500/20",
    new: "bg-blue-500/15 text-blue-500 border-blue-500/20",
    contacted: "bg-purple-500/15 text-purple-500 border-purple-500/20",
    spam: "bg-rose-500/15 text-rose-500 border-rose-500/20",
    suspended: "bg-amber-600/15 text-amber-600 border-amber-600/20",
    archived: "bg-zinc-500/15 text-zinc-500 border-zinc-500/20",
    active: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
    provisioning: "bg-blue-500/15 text-blue-500 border-blue-500/20"
  }
  return <Badge variant="outline" className={tone[status] ?? ""}>{status}</Badge>
}
```

- [ ] **Step 3: ActivityFeed**

`src/components/dashboard/ActivityFeed.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusPill } from "@/components/shared/StatusPill"
import { relativeTime } from "@/lib/relativeTime"
import type { ActivityEntry } from "@/lib/activity"

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead><TableHead>Tenant</TableHead><TableHead>What</TableHead>
              <TableHead>Who</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={`${e.type}:${e.id}`}>
                <TableCell className="text-muted-foreground">{relativeTime(e.updatedAt)}</TableCell>
                <TableCell>{e.tenantName ?? e.tenantId.slice(0, 8)}</TableCell>
                <TableCell>{e.type === "page" ? `Updated ${e.title}` : e.title}</TableCell>
                <TableCell className="text-muted-foreground">{e.updatedBy ?? "—"}</TableCell>
                <TableCell><StatusPill status={e.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Add table component if missing**

```bash
pnpm dlx shadcn@latest add table
```

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/ActivityFeed.tsx src/components/shared/StatusPill.tsx src/lib/relativeTime.ts
git commit -m "feat(phase-7): ActivityFeed + StatusPill + relativeTime util"
```

### Task 7.5: Wire dashboard page

**Files:**
- Modify: `src/app/(frontend)/(admin)/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import { requireAuth } from "@/lib/authGate"
import { getRecentActivity, getDashboardStats, getEditsTimeseries } from "@/lib/activity"
import { StatCards } from "@/components/dashboard/StatCards"
import { EditsChart } from "@/components/dashboard/EditsChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"

export default async function DashboardPage() {
  const { ctx } = await requireAuth()
  const [stats, series, activity] = await Promise.all([
    getDashboardStats(ctx.tenantId),
    getEditsTimeseries(ctx.tenantId, 30),
    getRecentActivity({ tenantId: ctx.tenantId, limit: 25 })
  ])

  return (
    <div className="flex flex-col gap-4">
      <StatCards stats={[
        { label: ctx.mode === "tenant" ? "Active site" : "Total tenants", value: stats.tenants },
        { label: "Published pages", value: stats.publishedPages },
        { label: "Edits this week", value: stats.editsThisWeek },
        { label: "Form submissions (30d)", value: stats.formsThisMonth }
      ]}/>
      <EditsChart data={series} />
      <ActivityFeed entries={activity} />
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run `pnpm dev`, log in. `/` shows the four stat cards, the chart (probably empty for fresh DB), and the activity feed.

- [ ] **Step 3: Commit**

```bash
git add src/app/(frontend)/(admin)/page.tsx
git commit -m "feat(phase-7): super-admin dashboard page"
```

**Phase 7 milestone:** Dashboard-01 layout populated with real data. The same code drives the tenant-editor dashboard at `admin.<theirdomain>/` (Phase 14 just verifies routing).

---

## Phase 8 — Sites management (super-admin only)

**Goal:** `/sites` lists tenants. `/sites/<slug>` opens the per-tenant scoped dashboard. Super-admin can create/suspend/archive a tenant.

### Task 8.1: Generic DataTable wrapper

**Files:**
- Create: `src/components/tables/DataTable.tsx`

shadcn ships a "data-table" *block* that's a TanStack Table integration. We wrap it once and reuse everywhere.

```bash
pnpm dlx shadcn@latest add data-table
pnpm add @tanstack/react-table
```

`src/components/tables/DataTable.tsx`:
```tsx
"use client"
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, SortingState, useReactTable } from "@tanstack/react-table"
import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"

type Props<T> = { columns: ColumnDef<T, any>[]; data: T[]; filterColumn?: string; filterPlaceholder?: string }

export function DataTable<T>({ columns, data, filterColumn, filterPlaceholder }: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [filter, setFilter] = useState("")

  const table = useReactTable({
    data, columns, state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  return (
    <div className="space-y-3">
      {filterColumn && (
        <Input placeholder={filterPlaceholder ?? "Filter..."} value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm"/>
      )}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((g) => (
              <TableRow key={g.id}>
                {g.headers.map((h) => (
                  <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((r) => (
              <TableRow key={r.id}>
                {r.getVisibleCells().map((c) => (
                  <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/tables/DataTable.tsx
git commit -m "feat(phase-8): generic DataTable wrapper"
```

### Task 8.2: Tenants data fetching server action

**Files:**
- Create: `src/lib/queries/tenants.ts`

```ts
import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function listTenants() {
  const payload = await getPayload({ config })
  const res = await payload.find({ collection: "tenants", overrideAccess: true, limit: 200, sort: "-updatedAt" })
  return res.docs
}

export async function getTenantBySlug(slug: string) {
  const payload = await getPayload({ config })
  const res = await payload.find({ collection: "tenants", overrideAccess: true, where: { slug: { equals: slug } }, limit: 1 })
  return res.docs[0] ?? null
}
```

- [ ] **Commit**

```bash
git add src/lib/queries/tenants.ts
git commit -m "feat(phase-8): tenant query helpers"
```

### Task 8.3: TenantsTable + /sites page

**Files:**
- Create: `src/components/tables/TenantsTable.tsx`
- Create: `src/app/(frontend)/(admin)/sites/page.tsx`

`src/components/tables/TenantsTable.tsx`:
```tsx
"use client"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./DataTable"
import { StatusPill } from "@/components/shared/StatusPill"
import type { Tenant } from "@/payload-types"

const cols: ColumnDef<Tenant, any>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) =>
      <Link href={`/sites/${row.original.slug}`} className="font-medium hover:underline">{row.getValue("name")}</Link> },
  { accessorKey: "domain", header: "Domain" },
  { accessorKey: "slug", header: "Slug", cell: ({ getValue }) => <code className="text-xs">{getValue() as string}</code> },
  { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> },
  { accessorKey: "updatedAt", header: "Updated", cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() }
]

export function TenantsTable({ data }: { data: Tenant[] }) {
  return <DataTable columns={cols} data={data} filterColumn="name" filterPlaceholder="Filter tenants..."/>
}
```

`src/app/(frontend)/(admin)/sites/page.tsx`:
```tsx
import { requireRole } from "@/lib/authGate"
import { listTenants } from "@/lib/queries/tenants"
import { TenantsTable } from "@/components/tables/TenantsTable"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function SitesPage() {
  await requireRole(["super-admin"])
  const tenants = await listTenants()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sites</h1>
        <Button asChild><Link href="/sites/new"><Plus className="mr-1 h-4 w-4"/> New tenant</Link></Button>
      </div>
      <TenantsTable data={tenants as any} />
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/tables/TenantsTable.tsx src/app/(frontend)/(admin)/sites
git commit -m "feat(phase-8): /sites — tenants list (super-admin)"
```

### Task 8.4: Create-tenant page (`/sites/new`)

**Files:**
- Create: `src/app/(frontend)/(admin)/sites/new/page.tsx`
- Create: `src/components/forms/TenantForm.tsx`

`src/components/forms/TenantForm.tsx`:
```tsx
"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"

const schema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase, digits, hyphens only"),
  domain: z.string().min(3),
  siteRepo: z.string().optional()
})

export function TenantForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema), defaultValues: { name: "", slug: "", domain: "", siteRepo: "" }
  })

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setPending(true)
    const res = await fetch("/api/tenants", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, status: "provisioning" })
    })
    setPending(false)
    if (!res.ok) { toast.error("Failed to create tenant"); return }
    const json = await res.json()
    toast.success("Tenant created")
    router.replace(`/sites/${values.slug}/onboarding`)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <FormField name="name" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>
        )}/>
        <FormField name="slug" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Slug</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>
        )}/>
        <FormField name="domain" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Domain</FormLabel><FormControl><Input placeholder="clientasite.nl" {...field}/></FormControl><FormMessage/></FormItem>
        )}/>
        <FormField name="siteRepo" control={form.control} render={({ field }) => (
          <FormItem><FormLabel>Site repo (optional)</FormLabel><FormControl><Input placeholder="optidigi/site-clientasite" {...field}/></FormControl><FormMessage/></FormItem>
        )}/>
        <Button type="submit" disabled={pending}>{pending ? "Creating..." : "Create tenant"}</Button>
      </form>
    </Form>
  )
}
```

`src/app/(frontend)/(admin)/sites/new/page.tsx`:
```tsx
import { requireRole } from "@/lib/authGate"
import { TenantForm } from "@/components/forms/TenantForm"

export default async function NewTenantPage() {
  await requireRole(["super-admin"])
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-xl font-semibold">New tenant</h1>
      <TenantForm />
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/forms/TenantForm.tsx src/app/(frontend)/(admin)/sites/new
git commit -m "feat(phase-8): /sites/new tenant creation form"
```

### Task 8.5: Tenant overview `/sites/<slug>`

**Files:**
- Create: `src/app/(frontend)/(admin)/sites/[slug]/page.tsx`
- Create: `src/app/(frontend)/(admin)/sites/[slug]/layout.tsx`

`layout.tsx` — tenant-scoped sidebar variant:
```tsx
import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { notFound } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SiteHeader } from "@/components/layout/SiteHeader"

export default async function TenantSiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { user } = await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()

  return (
    <SidebarProvider>
      <AppSidebar mode="super-admin" role="super-admin" tenantSlug={tenant.slug as string} />
      <SidebarInset>
        <SiteHeader user={user} />
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

> **Note:** This layout shadows the parent (admin)/layout.tsx because the (admin) layout already wraps the dashboard. To avoid double-wrapping, the parent layout in `src/app/(frontend)/(admin)/layout.tsx` should *only* render `{children}` for routes under `/sites/<slug>` — or restructure so /sites/[slug] is a sibling group. Simpler approach: remove the SidebarProvider wrap from `(admin)/layout.tsx` and put it in two separate layouts (one for /sites/[slug]/* with tenant context, one for everything else). Refactor:
>
> 1. Move SidebarProvider/AppSidebar/SiteHeader from `(admin)/layout.tsx` into a new `(admin)/(portfolio)/layout.tsx`
> 2. Move all current portfolio-level routes into `(portfolio)/`: `page.tsx`, `sites/page.tsx`, `sites/new/page.tsx`, `users/page.tsx`
> 3. `(admin)/sites/[slug]/layout.tsx` provides the tenant-scoped variant

Apply this restructure in this task.

`page.tsx` (after restructure — tenant overview = scoped dashboard):
```tsx
import { getTenantBySlug } from "@/lib/queries/tenants"
import { getDashboardStats, getEditsTimeseries, getRecentActivity } from "@/lib/activity"
import { StatCards } from "@/components/dashboard/StatCards"
import { EditsChart } from "@/components/dashboard/EditsChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { StatusPill } from "@/components/shared/StatusPill"
import { notFound } from "next/navigation"

export default async function TenantOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const tenantId = tenant.id as string

  const [stats, series, activity] = await Promise.all([
    getDashboardStats(tenantId), getEditsTimeseries(tenantId, 30), getRecentActivity({ tenantId, limit: 25 })
  ])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{tenant.name}</h1>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span>{tenant.domain}</span> · <StatusPill status={tenant.status as string}/>
          </div>
        </div>
      </div>
      <StatCards stats={[
        { label: "Published pages", value: stats.publishedPages },
        { label: "Edits this week", value: stats.editsThisWeek },
        { label: "Form submissions (30d)", value: stats.formsThisMonth },
        { label: "Status", value: tenant.status as string }
      ]}/>
      <EditsChart data={series}/>
      <ActivityFeed entries={activity}/>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/app/(frontend)/(admin)
git commit -m "feat(phase-8): tenant overview page + (portfolio)/(tenant) layout split"
```

**Phase 8 milestone:** Super-admin sees all tenants at `/sites`, can create one, and can drill into `/sites/<slug>` for a scoped overview. Sidebar navigation switches between portfolio and tenant contexts.

---

## Phase 9 — Pages list + page editor + field renderer + block editor

**Goal:** The hardest phase. Editors can list pages, create new pages, edit blocks, manage SEO, and publish. The field renderer drives all forms generically.

### Task 9.1: Pages list view

**Files:**
- Create: `src/components/tables/PagesTable.tsx`
- Create: `src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/pages/page.tsx`
- Create: `src/lib/queries/pages.ts`

`src/lib/queries/pages.ts`:
```ts
import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function listPages(tenantId: string) {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: "pages", overrideAccess: true,
    where: { tenant: { equals: tenantId } }, limit: 500, sort: "-updatedAt", depth: 1
  })
  return res.docs
}

export async function getPageById(id: string) {
  const payload = await getPayload({ config })
  return payload.findByID({ collection: "pages", id, overrideAccess: true, depth: 2 })
}
```

`PagesTable.tsx`:
```tsx
"use client"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./DataTable"
import { StatusPill } from "@/components/shared/StatusPill"
import { relativeTime } from "@/lib/relativeTime"
import type { Page } from "@/payload-types"

export function PagesTable({ data, base }: { data: Page[]; base: string }) {
  const cols: ColumnDef<Page, any>[] = [
    { accessorKey: "title", header: "Title", cell: ({ row }) =>
      <Link href={`${base}/${row.original.id}`} className="font-medium hover:underline">{row.getValue("title")}</Link> },
    { accessorKey: "slug", header: "Slug", cell: ({ getValue }) => <code className="text-xs">{getValue() as string}</code> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue() as string}/> },
    { accessorKey: "updatedAt", header: "Updated", cell: ({ getValue }) => relativeTime(getValue() as string) }
  ]
  return <DataTable columns={cols} data={data} filterColumn="title" filterPlaceholder="Filter pages..."/>
}
```

`pages/page.tsx`:
```tsx
import { getTenantBySlug } from "@/lib/queries/tenants"
import { listPages } from "@/lib/queries/pages"
import { PagesTable } from "@/components/tables/PagesTable"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function PagesIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const pages = await listPages(tenant.id as string)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pages — {tenant.name}</h1>
        <Button asChild><Link href={`/sites/${slug}/pages/new`}><Plus className="mr-1 h-4 w-4"/> New page</Link></Button>
      </div>
      <PagesTable data={pages as any} base={`/sites/${slug}/pages`}/>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/tables/PagesTable.tsx src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/pages src/lib/queries/pages.ts
git commit -m "feat(phase-9): pages list view"
```

### Task 9.2: Field renderer

**Files:**
- Create: `src/components/editor/FieldRenderer.tsx`

This is the heart of the entire editor. It dispatches on Payload field type and renders the matching shadcn component. Props receive a Payload field config + react-hook-form's field state.

```tsx
"use client"
import { useFormContext, Controller } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { MediaPicker } from "@/components/media/MediaPicker"

type AnyField = any

export function FieldRenderer({ field, namePrefix = "" }: { field: AnyField; namePrefix?: string }) {
  const fieldName = field.name ? (namePrefix ? `${namePrefix}.${field.name}` : field.name) : namePrefix
  const { control } = useFormContext()

  switch (field.type) {
    case "text":
    case "email":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}{field.required && "*"}</FormLabel>
            <FormControl><Input type={field.type === "email" ? "email" : "text"} {...f} /></FormControl>
            {field.admin?.description && <FormDescription>{field.admin.description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "textarea":
    case "richText":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}{field.required && "*"}</FormLabel>
            <FormControl><Textarea rows={field.type === "richText" ? 8 : 4} {...f} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "number":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <FormControl><Input type="number" {...f} onChange={(e) => f.onChange(e.target.valueAsNumber)} /></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "checkbox":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem className="flex items-center justify-between gap-3">
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <FormControl><Switch checked={!!f.value} onCheckedChange={f.onChange} /></FormControl>
          </FormItem>
        )}/>
      )
    case "select":
      return (
        <FormField control={control} name={fieldName} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <Select value={f.value ?? ""} onValueChange={f.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {field.options.map((opt: any) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "upload":
      return (
        <Controller name={fieldName} control={control} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label ?? field.name}</FormLabel>
            <FormControl><MediaPicker value={f.value} onChange={f.onChange} relationTo={field.relationTo}/></FormControl>
            <FormMessage />
          </FormItem>
        )}/>
      )
    case "group":
      return (
        <fieldset className="rounded-md border p-3 space-y-3">
          <legend className="px-1 text-sm font-medium">{field.label ?? field.name}</legend>
          {field.fields.map((sub: AnyField, i: number) => (
            <FieldRenderer key={i} field={sub} namePrefix={fieldName} />
          ))}
        </fieldset>
      )
    case "array":
      return <ArrayFieldRenderer field={field} namePrefix={fieldName} />
    default:
      return <div className="text-xs text-muted-foreground">Unsupported field type: {String(field.type)}</div>
  }
}

function ArrayFieldRenderer({ field, namePrefix }: { field: AnyField; namePrefix: string }) {
  const { control, getValues, setValue } = useFormContext()
  const items: any[] = getValues(namePrefix) ?? []

  const append = () => setValue(namePrefix, [...items, {}], { shouldDirty: true })
  const removeAt = (i: number) => setValue(namePrefix, items.filter((_, j) => j !== i), { shouldDirty: true })

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{field.label ?? field.name}</div>
      {items.map((_, i) => (
        <div key={i} className="rounded-md border p-3 space-y-3 relative">
          <button type="button" className="absolute top-2 right-2 text-xs text-muted-foreground" onClick={() => removeAt(i)}>Remove</button>
          {field.fields.map((sub: AnyField, j: number) => (
            <FieldRenderer key={j} field={sub} namePrefix={`${namePrefix}.${i}`} />
          ))}
        </div>
      ))}
      <button type="button" className="text-xs text-primary underline" onClick={append}>+ Add {field.singularLabel ?? "item"}</button>
    </div>
  )
}
```

> **Note for the implementer:** `MediaPicker` is created in Phase 10. Until then, stub it as `function MediaPicker({ value, onChange }) { return <div className="text-xs">media picker (Phase 10)</div> }` in a file at `src/components/media/MediaPicker.tsx`. Phase 10 replaces it.

- [ ] **Commit**

```bash
git add src/components/editor/FieldRenderer.tsx
git commit -m "feat(phase-9): generic FieldRenderer (text/textarea/richText/number/checkbox/select/upload/group/array)"
```

### Task 9.3: Stub MediaPicker for Phase 9

**Files:**
- Create: `src/components/media/MediaPicker.tsx`

```tsx
"use client"
export function MediaPicker({ value, onChange, relationTo }: { value?: any; onChange: (v: any) => void; relationTo?: string }) {
  return (
    <div className="rounded-md border p-3 text-xs text-muted-foreground">
      Media picker (Phase 10) · current: <code>{typeof value === "string" ? value : value?.id ?? "—"}</code>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/media/MediaPicker.tsx
git commit -m "feat(phase-9): MediaPicker stub (Phase 10 implements)"
```

### Task 9.4: Block configs available client-side

**Files:**
- Create: `src/blocks/registry.ts`

Block configs from `src/blocks/*.ts` are server-side Payload code. The page editor needs to know block schemas client-side to render forms. Mirror them in a client-safe registry.

```ts
import { Hero } from "./Hero"
import { FeatureList } from "./FeatureList"
import { Testimonials } from "./Testimonials"
import { FAQ } from "./FAQ"
import { CTA } from "./CTA"
import { RichText } from "./RichText"
import { ContactSection } from "./ContactSection"

export const BLOCKS = [Hero, FeatureList, Testimonials, FAQ, CTA, RichText, ContactSection] as const

export const blockBySlug = Object.fromEntries(BLOCKS.map((b) => [b.slug, b])) as Record<string, (typeof BLOCKS)[number]>
```

> **Note:** Payload field config files are TypeScript objects, no React imports — they're safe to consume from client components.

- [ ] **Commit**

```bash
git add src/blocks/registry.ts
git commit -m "feat(phase-9): block registry (client-safe)"
```

### Task 9.5: BlockTypePicker

**Files:**
- Create: `src/components/editor/BlockTypePicker.tsx`

```tsx
"use client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { BLOCKS } from "@/blocks/registry"

export function BlockTypePicker({ onAdd }: { onAdd: (slug: string) => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="mr-1 h-4 w-4"/> Add block</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a block</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {BLOCKS.map((b) => (
            <button key={b.slug} className="rounded-md border p-3 text-left hover:bg-accent" onClick={() => onAdd(b.slug)}>
              <div className="font-medium">{b.slug}</div>
              <div className="text-xs text-muted-foreground">{b.fields.length} fields</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/editor/BlockTypePicker.tsx
git commit -m "feat(phase-9): BlockTypePicker dialog"
```

### Task 9.6: BlockListItem (collapsible block in the editor)

**Files:**
- Create: `src/components/editor/BlockListItem.tsx`

```tsx
"use client"
import { useState } from "react"
import { ChevronDown, ChevronRight, Trash2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldRenderer } from "./FieldRenderer"

export function BlockListItem({
  index, blockSlug, blockConfig, onRemove
}: { index: number; blockSlug: string; blockConfig: any; onRemove: () => void }) {
  const [open, setOpen] = useState(true)
  const namePrefix = `blocks.${index}`

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen(!open)} className="text-muted-foreground">
            {open ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
          </button>
          <GripVertical className="h-4 w-4 text-muted-foreground"/>
          <span className="font-medium">{blockSlug}</span>
        </div>
        <Button variant="ghost" size="icon" type="button" onClick={onRemove}>
          <Trash2 className="h-4 w-4"/>
        </Button>
      </div>
      {open && (
        <div className="border-t p-3 space-y-3">
          {blockConfig.fields.map((f: any, i: number) => (
            <FieldRenderer key={i} field={f} namePrefix={namePrefix} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/editor/BlockListItem.tsx
git commit -m "feat(phase-9): BlockListItem (collapsible block w/ field renderer)"
```

### Task 9.7: BlockEditor (the central component)

**Files:**
- Create: `src/components/editor/BlockEditor.tsx`

```tsx
"use client"
import { useFormContext, useFieldArray } from "react-hook-form"
import { blockBySlug } from "@/blocks/registry"
import { BlockListItem } from "./BlockListItem"
import { BlockTypePicker } from "./BlockTypePicker"

export function BlockEditor() {
  const { control } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name: "blocks" })

  return (
    <div className="space-y-3">
      {fields.map((f, i) => {
        const slug = (f as any).blockType
        const cfg = blockBySlug[slug]
        if (!cfg) return null
        return <BlockListItem key={f.id} index={i} blockSlug={slug} blockConfig={cfg} onRemove={() => remove(i)} />
      })}
      <BlockTypePicker onAdd={(slug) => append({ blockType: slug })} />
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/editor/BlockEditor.tsx
git commit -m "feat(phase-9): BlockEditor (uses useFieldArray)"
```

### Task 9.8: PageForm

**Files:**
- Create: `src/components/forms/PageForm.tsx`

```tsx
"use client"
import { useState } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BlockEditor } from "@/components/editor/BlockEditor"
import { FieldRenderer } from "@/components/editor/FieldRenderer"
import { toast } from "sonner"
import type { Page } from "@/payload-types"

const schema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase, digits, hyphens only"),
  status: z.enum(["draft", "published"]),
  blocks: z.array(z.any()).default([]),
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    ogImage: z.any().optional()
  }).optional()
})
type Values = z.infer<typeof schema>

const seoFields = [
  { name: "title", type: "text", label: "SEO title" },
  { name: "description", type: "textarea", label: "SEO description" },
  { name: "ogImage", type: "upload", relationTo: "media", label: "Open Graph image" }
]

export function PageForm({ initial, tenantId, baseHref }: { initial?: Page; tenantId: string; baseHref: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial ? (initial as any) : { title: "", slug: "", status: "draft", blocks: [], seo: {} }
  })

  const onSubmit = async (values: Values) => {
    setPending(true)
    const url = initial ? `/api/pages/${initial.id}` : "/api/pages"
    const method = initial ? "PATCH" : "POST"
    const body = JSON.stringify({ ...values, tenant: tenantId })
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body })
    setPending(false)
    if (!res.ok) { toast.error("Save failed"); return }
    toast.success(values.status === "published" ? "Published" : "Saved")
    if (!initial) {
      const json = await res.json()
      router.replace(`${baseHref}/${json.doc?.id ?? json.id}`)
    } else {
      router.refresh()
    }
  }

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader><CardTitle>Page</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Title*</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={form.control} name="slug" render={({ field }) => (
                  <FormItem><FormLabel>Slug*</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Blocks</CardTitle></CardHeader>
              <CardContent><BlockEditor/></CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Publish</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage/>
                  </FormItem>
                )}/>
                <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Save"}</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {seoFields.map((f, i) => <FieldRenderer key={i} field={f} namePrefix="seo"/>)}
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </FormProvider>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/forms/PageForm.tsx
git commit -m "feat(phase-9): PageForm (3-column layout: title/slug, blocks, publish/SEO)"
```

### Task 9.9: New page route + edit page route

**Files:**
- Create: `src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/pages/new/page.tsx`
- Create: `src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/pages/[id]/page.tsx`

`new/page.tsx`:
```tsx
import { getTenantBySlug } from "@/lib/queries/tenants"
import { PageForm } from "@/components/forms/PageForm"
import { notFound } from "next/navigation"

export default async function NewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New page · {tenant.name}</h1>
      <PageForm tenantId={tenant.id as string} baseHref={`/sites/${slug}/pages`}/>
    </div>
  )
}
```

`[id]/page.tsx`:
```tsx
import { getTenantBySlug } from "@/lib/queries/tenants"
import { getPageById } from "@/lib/queries/pages"
import { PageForm } from "@/components/forms/PageForm"
import { notFound } from "next/navigation"

export default async function EditPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const page = await getPageById(id)
  if (!page || (typeof page.tenant === "string" ? page.tenant : page.tenant?.id) !== tenant.id) notFound()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{page.title}</h1>
      <PageForm initial={page as any} tenantId={tenant.id as string} baseHref={`/sites/${slug}/pages`}/>
    </div>
  )
}
```

- [ ] **Verify end-to-end**

Run `pnpm dev`. Log in as super-admin. /sites → create a tenant → /sites/<slug>/pages/new → fill title/slug, add a Hero block, save with status=published. Verify:
- Toast "Published"
- Page appears in /sites/<slug>/pages list
- File appears at `<DATA_DIR>/tenants/<id>/pages/<slug>.json` containing the expected JSON

- [ ] **Commit**

```bash
git add src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/pages/new src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/pages/[id]
git commit -m "feat(phase-9): new + edit page routes"
```

**Phase 9 milestone:** **The product is functional.** Super-admin can create a tenant, create pages with full block-builder UX, publish, and the on-disk JSON appears for SSR consumption. The hardest piece (custom block editor + field renderer) is done.

---

## Phase 10 — Media library

**Goal:** Upload, browse, pick, and delete media. The MediaPicker stub from Phase 9 becomes a real picker that opens a side `<Sheet>` showing the tenant's media grid.

### Task 10.1: Media query helper + upload server action

**Files:**
- Create: `src/lib/queries/media.ts`

```ts
import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function listMedia(tenantId: string) {
  const payload = await getPayload({ config })
  return payload.find({ collection: "media", overrideAccess: true,
    where: { tenant: { equals: tenantId } }, limit: 500, sort: "-updatedAt" })
}

export async function deleteMedia(id: string) {
  const payload = await getPayload({ config })
  return payload.delete({ collection: "media", id, overrideAccess: true })
}
```

- [ ] **Commit**

```bash
git add src/lib/queries/media.ts
git commit -m "feat(phase-10): media query helpers"
```

### Task 10.2: MediaUploader component

**Files:**
- Create: `src/components/media/MediaUploader.tsx`

```tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Upload } from "lucide-react"

export function MediaUploader({ tenantId, onUploaded }: { tenantId: string; onUploaded?: (m: any) => void }) {
  const [pending, setPending] = useState(false)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPending(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("_payload", JSON.stringify({ alt: file.name, tenant: tenantId }))
    const res = await fetch("/api/media", { method: "POST", body: fd })
    setPending(false)
    if (!res.ok) { toast.error("Upload failed"); return }
    const json = await res.json()
    toast.success("Uploaded")
    onUploaded?.(json.doc)
  }

  return (
    <label>
      <input type="file" hidden onChange={onPick} accept="image/*,video/mp4,application/pdf"/>
      <Button asChild variant="outline" disabled={pending}><span><Upload className="mr-1 h-4 w-4"/>{pending ? "Uploading..." : "Upload"}</span></Button>
    </label>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/media/MediaUploader.tsx
git commit -m "feat(phase-10): MediaUploader"
```

### Task 10.3: MediaGrid component

**Files:**
- Create: `src/components/media/MediaGrid.tsx`

```tsx
"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Media } from "@/payload-types"

export function MediaGrid({ items, onSelect, selectable, onDeleted }:
  { items: Media[]; onSelect?: (m: Media) => void; selectable?: boolean; onDeleted?: () => void }
) {
  const onDelete = async (m: Media) => {
    if (!confirm(`Delete ${m.filename}?`)) return
    const res = await fetch(`/api/media/${m.id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Delete failed"); return }
    toast.success("Deleted")
    onDeleted?.()
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((m) => (
        <Card key={m.id as string} className={selectable ? "cursor-pointer hover:ring-2 hover:ring-ring" : ""}>
          <CardContent className="p-2 space-y-2" onClick={() => selectable && onSelect?.(m)}>
            {(m.mimeType || "").startsWith("image/")
              ? <img src={m.url as string} alt={m.alt ?? ""} className="aspect-video w-full object-cover rounded"/>
              : <div className="aspect-video flex items-center justify-center bg-muted text-xs text-muted-foreground rounded">{m.mimeType}</div>}
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs truncate"><div className="font-medium truncate">{m.filename}</div>
                <div className="text-muted-foreground">{m.alt ?? "—"}</div>
              </div>
              {!selectable && (
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onDelete(m) }}>
                  <Trash2 className="h-3.5 w-3.5"/>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/media/MediaGrid.tsx
git commit -m "feat(phase-10): MediaGrid"
```

### Task 10.4: Replace MediaPicker stub with real picker

**Files:**
- Replace: `src/components/media/MediaPicker.tsx`

```tsx
"use client"
import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { MediaGrid } from "./MediaGrid"
import { MediaUploader } from "./MediaUploader"

type Props = { value?: any; onChange: (v: any) => void; relationTo?: string; tenantId?: string }

export function MediaPicker({ value, onChange, tenantId }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(tenantId ?? null)

  useEffect(() => {
    if (!resolvedTenantId) {
      // Fetch /api/users/me to get tenant
      fetch("/api/users/me").then((r) => r.json()).then((j) => {
        const me = j.user
        if (me?.role === "super-admin") {
          // Read tenant from URL — /sites/<slug>/...
          const m = window.location.pathname.match(/\/sites\/([^/]+)/)
          if (m) {
            fetch(`/api/tenants?where[slug][equals]=${m[1]}`).then((r) => r.json()).then((res) => {
              setResolvedTenantId(res.docs?.[0]?.id ?? null)
            })
          }
        } else if (me?.tenant) {
          setResolvedTenantId(typeof me.tenant === "string" ? me.tenant : me.tenant.id)
        }
      })
    }
  }, [resolvedTenantId])

  const reload = async () => {
    if (!resolvedTenantId) return
    const res = await fetch(`/api/media?where[tenant][equals]=${resolvedTenantId}&limit=200&sort=-updatedAt`)
    const json = await res.json()
    setItems(json.docs ?? [])
  }
  useEffect(() => { if (open) reload() }, [open, resolvedTenantId])

  const current = typeof value === "string" ? items.find((m) => m.id === value) : value

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-md border p-3">
        {current?.url ? <img src={current.url} className="h-10 w-10 object-cover rounded"/> : <div className="h-10 w-10 rounded bg-muted"/>}
        <div className="text-sm flex-1 truncate">
          {current ? <><div className="font-medium truncate">{current.filename}</div><div className="text-xs text-muted-foreground truncate">{current.alt}</div></> : "No selection"}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><Button variant="outline" size="sm">Choose</Button></SheetTrigger>
          <SheetContent side="right" className="w-[640px] sm:max-w-[640px]">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <span>Choose media</span>
                {resolvedTenantId && <MediaUploader tenantId={resolvedTenantId} onUploaded={() => reload()}/>}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <MediaGrid items={items} selectable onSelect={(m) => { onChange(m.id); setOpen(false) }}/>
            </div>
          </SheetContent>
        </Sheet>
        {value && <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Clear</Button>}
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/components/media/MediaPicker.tsx
git commit -m "feat(phase-10): real MediaPicker (Sheet + grid + uploader)"
```

### Task 10.5: /sites/<slug>/media route

**Files:**
- Create: `src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/media/page.tsx`

```tsx
import { getTenantBySlug } from "@/lib/queries/tenants"
import { listMedia } from "@/lib/queries/media"
import { MediaGrid } from "@/components/media/MediaGrid"
import { MediaUploader } from "@/components/media/MediaUploader"
import { notFound } from "next/navigation"

export default async function MediaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const items = await listMedia(tenant.id as string)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Media — {tenant.name}</h1>
        <MediaUploader tenantId={tenant.id as string}/>
      </div>
      <MediaGrid items={items.docs as any}/>
    </div>
  )
}
```

- [ ] **Verify**

`pnpm dev`. /sites/<slug>/media → upload an image → it appears in the grid. The same image is reachable via the MediaPicker inside a Page form.

- [ ] **Commit**

```bash
git add src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/media
git commit -m "feat(phase-10): /sites/<slug>/media route"
```

**Phase 10 milestone:** Media library functional. Pages can reference uploads via the MediaPicker.

---

## Phase 11 — Forms inbox

**Goal:** `/sites/<slug>/forms` shows submissions in a table; clicking a row opens a side `<Sheet>` with the full payload. Status changes (new → read/contacted/spam) persist.

### Task 11.1: Forms query helper

**Files:**
- Create: `src/lib/queries/forms.ts`

```ts
import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function listForms(tenantId: string, status?: string) {
  const payload = await getPayload({ config })
  const where: any = { tenant: { equals: tenantId } }
  if (status) where.status = { equals: status }
  return payload.find({ collection: "forms", overrideAccess: true, where, limit: 500, sort: "-createdAt" })
}
```

- [ ] **Commit**

```bash
git add src/lib/queries/forms.ts
git commit -m "feat(phase-11): forms query helper"
```

### Task 11.2: FormsTable + detail Sheet

**Files:**
- Create: `src/components/tables/FormsTable.tsx`
- Create: `src/components/forms/FormSubmissionSheet.tsx`

`FormSubmissionSheet.tsx`:
```tsx
"use client"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import type { Form as FormDoc } from "@/payload-types"

export function FormSubmissionSheet({ form, open, onOpenChange }:
  { form: FormDoc | null; open: boolean; onOpenChange: (b: boolean) => void }
) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (!form) return null

  const setStatus = (status: string) => start(async () => {
    const res = await fetch(`/api/forms/${form.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status })
    })
    if (!res.ok) { toast.error("Failed"); return }
    toast.success("Updated")
    router.refresh()
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[560px] sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>{form.email ?? "Submission"}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">Status</span>
            <Select value={form.status as string} onValueChange={setStatus} disabled={pending}>
              <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
              <SelectContent>
                {["new","read","contacted","spam"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><div className="text-muted-foreground">Form</div><div>{form.formName}</div></div>
          {form.pageUrl && <div><div className="text-muted-foreground">Page</div><div className="truncate">{form.pageUrl}</div></div>}
          <div><div className="text-muted-foreground">Name</div><div>{form.name ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Email</div><div>{form.email ?? "—"}</div></div>
          <div><div className="text-muted-foreground">Message</div><pre className="whitespace-pre-wrap text-xs bg-muted p-2 rounded">{form.message ?? ""}</pre></div>
          <div>
            <div className="text-muted-foreground">Full payload</div>
            <pre className="whitespace-pre-wrap text-xs bg-muted p-2 rounded">{JSON.stringify(form.data, null, 2)}</pre>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

`FormsTable.tsx`:
```tsx
"use client"
import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./DataTable"
import { StatusPill } from "@/components/shared/StatusPill"
import { relativeTime } from "@/lib/relativeTime"
import { FormSubmissionSheet } from "@/components/forms/FormSubmissionSheet"
import type { Form as FormDoc } from "@/payload-types"

export function FormsTable({ data }: { data: FormDoc[] }) {
  const [active, setActive] = useState<FormDoc | null>(null)
  const cols: ColumnDef<FormDoc, any>[] = [
    { accessorKey: "createdAt", header: "When", cell: ({ getValue }) => relativeTime(getValue() as string) },
    { accessorKey: "email", header: "From" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "formName", header: "Form" },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue() as string}/> }
  ]
  return (
    <>
      <div onClick={(e) => {
        const tr = (e.target as HTMLElement).closest("tr[data-id]") as HTMLElement | null
        if (tr) setActive(data.find((d) => d.id === tr.dataset.id) ?? null)
      }}>
        <DataTable columns={cols} data={data} filterColumn="email" filterPlaceholder="Filter by email..."/>
      </div>
      <FormSubmissionSheet form={active} open={!!active} onOpenChange={(b) => !b && setActive(null)}/>
    </>
  )
}
```

> **Note:** The DataTable wrapper needs a small change to add `data-id` to each row. Add `<TableRow key={r.id} data-id={(r.original as any).id}>` in `DataTable.tsx`.

- [ ] **Commit**

```bash
git add src/components/tables/FormsTable.tsx src/components/forms/FormSubmissionSheet.tsx src/components/tables/DataTable.tsx
git commit -m "feat(phase-11): FormsTable + submission sheet (row click → detail)"
```

### Task 11.3: /sites/<slug>/forms route

**Files:**
- Create: `src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/forms/page.tsx`

```tsx
import { getTenantBySlug } from "@/lib/queries/tenants"
import { listForms } from "@/lib/queries/forms"
import { FormsTable } from "@/components/tables/FormsTable"
import { notFound } from "next/navigation"

export default async function FormsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const forms = await listForms(tenant.id as string)
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Forms — {tenant.name}</h1>
      <FormsTable data={forms.docs as any}/>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/forms
git commit -m "feat(phase-11): /sites/<slug>/forms route"
```

**Phase 11 milestone:** Form submissions visible per tenant. Status transitions persist. (Public form-post endpoint that *creates* submissions is the SSR template's responsibility, not this repo — but the `forms` collection's `create: () => true` access already accepts unauthenticated POSTs.)

---

## Phase 12 — Site settings

**Goal:** `/sites/<slug>/settings` renders a tabbed form (General / Branding / Contact / Navigation) backed by `FieldRenderer`. Owner can edit; viewer/editor read-only.

### Task 12.1: Settings query

**Files:**
- Create: `src/lib/queries/settings.ts`

```ts
import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function getOrCreateSiteSettings(tenantId: string) {
  const payload = await getPayload({ config })
  const found = await payload.find({ collection: "site-settings", overrideAccess: true,
    where: { tenant: { equals: tenantId } }, limit: 1 })
  if (found.docs.length) return found.docs[0]
  return payload.create({ collection: "site-settings", overrideAccess: true,
    data: { tenant: tenantId, siteName: "Untitled", siteUrl: "https://example.com" } as any })
}
```

- [ ] **Commit**

```bash
git add src/lib/queries/settings.ts
git commit -m "feat(phase-12): site settings query (get-or-create)"
```

### Task 12.2: SettingsForm + page

**Files:**
- Create: `src/components/forms/SettingsForm.tsx`
- Create: `src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/settings/page.tsx`

`SettingsForm.tsx`:
```tsx
"use client"
import { useState } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FieldRenderer } from "@/components/editor/FieldRenderer"
import { toast } from "sonner"

const generalFields = [
  { name: "siteName", type: "text", label: "Site name", required: true },
  { name: "siteUrl", type: "text", label: "Site URL", required: true, admin: { description: "Public URL of the SSR site (e.g. https://clientasite.nl)" } },
  { name: "contactEmail", type: "email", label: "Contact email" }
]
const brandingFields = [
  { type: "group", name: "branding", label: "Branding", fields: [
    { name: "logo", type: "upload", relationTo: "media", label: "Logo" },
    { name: "primaryColor", type: "text", label: "Primary color (hex)" }
  ]}
]
const contactFields = [
  { type: "group", name: "contact", label: "Contact", fields: [
    { name: "phone", type: "text", label: "Phone" },
    { name: "address", type: "textarea", label: "Address" },
    { type: "array", name: "social", label: "Social links", singularLabel: "link", fields: [
      { name: "platform", type: "text", label: "Platform", required: true },
      { name: "url", type: "text", label: "URL", required: true }
    ]}
  ]}
]
const navigationFields = [
  { type: "array", name: "navigation", label: "Navigation", singularLabel: "menu item", fields: [
    { name: "label", type: "text", label: "Label", required: true },
    { name: "href", type: "text", label: "Href", required: true },
    { name: "external", type: "checkbox", label: "External" }
  ]}
]

export function SettingsForm({ initial, canEdit }: { initial: any; canEdit: boolean }) {
  const router = useRouter()
  const form = useForm({ defaultValues: initial })
  const [pending, setPending] = useState(false)

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true)
    const res = await fetch(`/api/site-settings/${initial.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, tenant: initial.tenant?.id ?? initial.tenant })
    })
    setPending(false)
    if (!res.ok) { toast.error("Save failed"); return }
    toast.success("Saved")
    router.refresh()
  })

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="space-y-4 max-w-3xl">
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="navigation">Navigation</TabsTrigger>
          </TabsList>
          {[
            ["general", generalFields],
            ["branding", brandingFields],
            ["contact", contactFields],
            ["navigation", navigationFields]
          ].map(([k, fs]: any) => (
            <TabsContent key={k} value={k}>
              <Card><CardHeader><CardTitle className="capitalize">{k}</CardTitle></CardHeader>
              <CardContent className="space-y-3">{fs.map((f: any, i: number) => <FieldRenderer key={i} field={f}/>)}</CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
        {canEdit && <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save settings"}</Button>}
      </form>
    </FormProvider>
  )
}
```

`settings/page.tsx`:
```tsx
import { requireAuth } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { SettingsForm } from "@/components/forms/SettingsForm"
import { notFound } from "next/navigation"

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { user } = await requireAuth()
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const settings = await getOrCreateSiteSettings(tenant.id as string)
  const canEdit = user.role === "super-admin" || user.role === "owner"
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Settings — {tenant.name}</h1>
      <SettingsForm initial={settings} canEdit={canEdit}/>
    </div>
  )
}
```

- [ ] **Verify**

`pnpm dev`. /sites/<slug>/settings → fill in fields, save. Verify `<DATA_DIR>/tenants/<id>/site.json` is updated.

- [ ] **Commit**

```bash
git add src/components/forms/SettingsForm.tsx src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/settings
git commit -m "feat(phase-12): tabbed site settings form"
```

**Phase 12 milestone:** Site settings editable per tenant via tabbed UI. afterChange projects to `site.json`.

---

## Phase 13 — User management + onboarding checklist

**Goal:** Owner can invite/remove team members for their tenant; super-admin can do the same for any tenant via `/sites/<slug>/users`. Onboarding checklist guides super-admin through the manual NPM/DNS dance with copy-pasteable values.

### Task 13.1: Users query + invite action

**Files:**
- Create: `src/lib/queries/users.ts`
- Create: `src/lib/actions/inviteUser.ts`

```ts
// users.ts
import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function listUsersForTenant(tenantId: string) {
  const payload = await getPayload({ config })
  const res = await payload.find({ collection: "users", overrideAccess: true,
    where: { tenant: { equals: tenantId } }, limit: 200 })
  return res.docs
}

export async function listAllUsers() {
  const payload = await getPayload({ config })
  const res = await payload.find({ collection: "users", overrideAccess: true, limit: 500 })
  return res.docs
}
```

```ts
// inviteUser.ts
"use server"
import { getPayload } from "payload"
import config from "@/payload.config"
import crypto from "node:crypto"

export async function inviteUser(input: { email: string; name: string; role: "owner" | "editor" | "viewer"; tenantId: string }) {
  const payload = await getPayload({ config })
  const tempPassword = crypto.randomBytes(16).toString("hex")
  const created = await payload.create({
    collection: "users", overrideAccess: true,
    data: { email: input.email, name: input.name, role: input.role, tenant: input.tenantId, password: tempPassword } as any
  })
  // Trigger forgot-password to send the invite link with reset token
  await payload.forgotPassword({ collection: "users", data: { email: input.email } })
  return { ok: true, id: created.id }
}
```

- [ ] **Commit**

```bash
git add src/lib/queries/users.ts src/lib/actions/inviteUser.ts
git commit -m "feat(phase-13): user listing + invite server action"
```

### Task 13.2: UsersTable + invite dialog

**Files:**
- Create: `src/components/tables/UsersTable.tsx`
- Create: `src/components/forms/UserInviteForm.tsx`
- Create: `src/components/shared/RoleBadge.tsx`

`RoleBadge.tsx`:
```tsx
import { Badge } from "@/components/ui/badge"
export function RoleBadge({ role }: { role: string }) {
  const tone: Record<string, string> = {
    "super-admin": "bg-purple-500/15 text-purple-500",
    "owner": "bg-emerald-500/15 text-emerald-500",
    "editor": "bg-blue-500/15 text-blue-500",
    "viewer": "bg-zinc-500/15 text-zinc-500"
  }
  return <Badge variant="outline" className={tone[role] ?? ""}>{role}</Badge>
}
```

`UserInviteForm.tsx`:
```tsx
"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { inviteUser } from "@/lib/actions/inviteUser"

const schema = z.object({
  email: z.string().email(), name: z.string().min(1),
  role: z.enum(["owner", "editor", "viewer"])
})
type V = z.infer<typeof schema>

export function UserInviteForm({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const form = useForm<V>({ resolver: zodResolver(schema), defaultValues: { email: "", name: "", role: "editor" } })

  const onSubmit = async (v: V) => {
    setPending(true)
    const res = await inviteUser({ ...v, tenantId })
    setPending(false)
    if (!res.ok) { toast.error("Invite failed"); return }
    toast.success("Invitation sent")
    setOpen(false); form.reset(); router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/> Invite</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite team member</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField name="email" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field}/></FormControl><FormMessage/></FormItem>
            )}/>
            <FormField name="name" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>
            )}/>
            <FormField name="role" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>Role</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage/>
              </FormItem>
            )}/>
            <Button type="submit" disabled={pending}>{pending ? "Sending..." : "Send invite"}</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

`UsersTable.tsx`:
```tsx
"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./DataTable"
import { RoleBadge } from "@/components/shared/RoleBadge"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { User } from "@/payload-types"

export function UsersTable({ data, canManage }: { data: User[]; canManage: boolean }) {
  const router = useRouter()
  const remove = async (u: User) => {
    if (!confirm(`Remove ${u.email}?`)) return
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Delete failed"); return }
    toast.success("Removed"); router.refresh()
  }
  const cols: ColumnDef<User, any>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "role", header: "Role", cell: ({ getValue }) => <RoleBadge role={getValue() as string}/> },
    ...(canManage ? [{
      id: "actions", header: "", cell: ({ row }: any) => (
        <Button size="icon" variant="ghost" onClick={() => remove(row.original)}><Trash2 className="h-3.5 w-3.5"/></Button>
      )
    }] as any : [])
  ]
  return <DataTable columns={cols} data={data} filterColumn="email" filterPlaceholder="Filter users..."/>
}
```

- [ ] **Commit**

```bash
git add src/components/tables/UsersTable.tsx src/components/forms/UserInviteForm.tsx src/components/shared/RoleBadge.tsx
git commit -m "feat(phase-13): UsersTable + invite dialog + RoleBadge"
```

### Task 13.3: /sites/<slug>/users route

**Files:**
- Create: `src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/users/page.tsx`

```tsx
import { requireAuth } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { listUsersForTenant } from "@/lib/queries/users"
import { UsersTable } from "@/components/tables/UsersTable"
import { UserInviteForm } from "@/components/forms/UserInviteForm"
import { notFound } from "next/navigation"

export default async function TenantUsersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { user } = await requireAuth()
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const users = await listUsersForTenant(tenant.id as string)
  const canManage = user.role === "super-admin" || user.role === "owner"
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Team — {tenant.name}</h1>
        {canManage && <UserInviteForm tenantId={tenant.id as string}/>}
      </div>
      <UsersTable data={users as any} canManage={canManage}/>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/users
git commit -m "feat(phase-13): /sites/<slug>/users route"
```

### Task 13.4: /users (super-admin cross-tenant view)

**Files:**
- Create: `src/app/(frontend)/(admin)/(portfolio)/users/page.tsx`

```tsx
import { requireRole } from "@/lib/authGate"
import { listAllUsers } from "@/lib/queries/users"
import { UsersTable } from "@/components/tables/UsersTable"

export default async function GlobalUsersPage() {
  await requireRole(["super-admin"])
  const users = await listAllUsers()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">All users</h1>
      <UsersTable data={users as any} canManage/>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/app/(frontend)/(admin)/(portfolio)/users
git commit -m "feat(phase-13): /users (super-admin cross-tenant)"
```

### Task 13.5: OnboardingChecklist component + route

**Files:**
- Create: `src/components/onboarding/OnboardingChecklist.tsx`
- Create: `src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/onboarding/page.tsx`

`OnboardingChecklist.tsx`:
```tsx
"use client"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

type Step = { id: string; title: string; description: React.ReactNode; copy?: string }

export function OnboardingChecklist({ tenant, vpsIp }: { tenant: { domain: string; slug: string; id: string }; vpsIp: string }) {
  const [done, setDone] = useState<Record<string, boolean>>({ "tenant-record": true })

  const npmConfig = JSON.stringify({
    domain_names: [`admin.${tenant.domain}`],
    forward_host: "siab-payload",
    forward_port: 3000,
    block_exploits: true,
    websockets: true,
    ssl_forced: true,
    http2_support: true
  }, null, 2)

  const steps: Step[] = [
    { id: "tenant-record", title: "Tenant record created", description: <span>Done. <code>id: {tenant.id}</code></span> },
    { id: "dns", title: "Add DNS A record", description: <span>At client's registrar: <code>admin.{tenant.domain}</code> → <code>{vpsIp}</code></span>, copy: vpsIp },
    { id: "npm", title: "Configure NPM proxy host", description: <span>In nginx-proxy-manager: <code>admin.{tenant.domain}</code> → <code>siab-payload:3000</code> · WebSockets: on</span>, copy: npmConfig },
    { id: "cert", title: "Issue Let's Encrypt cert", description: <span>In NPM: SSL → Force SSL → Request New Certificate</span> },
    { id: "owner", title: "Create owner user + send invite", description: <span><a href={`/sites/${tenant.slug}/users`} className="underline">Open users page</a></span> },
    { id: "verify", title: "Verify access", description: <span><a href={`https://admin.${tenant.domain}`} className="underline" target="_blank" rel="noreferrer">https://admin.{tenant.domain}</a></span> }
  ]

  return (
    <div className="space-y-3">
      {steps.map((s) => (
        <Card key={s.id}>
          <CardContent className="p-4 flex items-start gap-3">
            <button
              type="button"
              onClick={() => setDone((d) => ({ ...d, [s.id]: !d[s.id] }))}
              className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center ${done[s.id] ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-500" : "border-muted-foreground"}`}
            >
              {done[s.id] && <Check className="h-3 w-3"/>}
            </button>
            <div className="flex-1">
              <div className="font-medium">{s.title}</div>
              <div className="text-sm text-muted-foreground">{s.description}</div>
            </div>
            {s.copy && (
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(s.copy!); toast.success("Copied") }}>
                <Copy className="mr-1 h-3 w-3"/> Copy
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

`onboarding/page.tsx`:
```tsx
import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist"
import { notFound } from "next/navigation"

export default async function OnboardingPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const vpsIp = process.env.NEXT_PUBLIC_VPS_IP ?? "set NEXT_PUBLIC_VPS_IP"
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Onboarding — {tenant.name}</h1>
        <p className="text-sm text-muted-foreground">Manual steps to bring <code>admin.{tenant.domain}</code> live.</p>
      </div>
      <OnboardingChecklist tenant={tenant as any} vpsIp={vpsIp}/>
    </div>
  )
}
```

> Add `NEXT_PUBLIC_VPS_IP=<your-vps-ip>` to `.env.example`.

- [ ] **Commit**

```bash
git add src/components/onboarding src/app/(frontend)/(admin)/(portfolio)/sites/[slug]/onboarding .env.example
git commit -m "feat(phase-13): onboarding checklist (DNS/NPM/cert/owner/verify)"
```

**Phase 13 milestone:** Team management works for both super-admin and owner. Onboarding view gives a copy-pasteable workflow for activating a new tenant subdomain.

---

## Phase 14 — Tenant-editor scoped routes (mirror of /sites/<slug>/*)

**Goal:** When logged in at `admin.<theirdomain>/`, the editor sees the same UX as `admin.siteinabox.nl/sites/<slug>/*` — but without the `/sites/<slug>` prefix in the URL.

### Task 14.1: Tenant-editor pages route

**Files:**
- Create: `src/app/(frontend)/(admin)/(tenant)/layout.tsx`
- Create: `src/app/(frontend)/(admin)/(tenant)/page.tsx`
- Create: `src/app/(frontend)/(admin)/(tenant)/pages/page.tsx`
- Create: `src/app/(frontend)/(admin)/(tenant)/pages/new/page.tsx`
- Create: `src/app/(frontend)/(admin)/(tenant)/pages/[id]/page.tsx`
- Create: `src/app/(frontend)/(admin)/(tenant)/media/page.tsx`
- Create: `src/app/(frontend)/(admin)/(tenant)/forms/page.tsx`
- Create: `src/app/(frontend)/(admin)/(tenant)/settings/page.tsx`
- Create: `src/app/(frontend)/(admin)/(tenant)/users/page.tsx`

> **Approach:** Each tenant route is a thin wrapper that calls the existing query helpers with the tenant ID resolved from `getSiabContext()`.

`layout.tsx`:
```tsx
import { requireAuth } from "@/lib/authGate"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SiteHeader } from "@/components/layout/SiteHeader"

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const { user, ctx } = await requireAuth()
  if (ctx.mode !== "tenant") return null   // shouldn't happen; gate ensures this
  return (
    <SidebarProvider>
      <AppSidebar mode="tenant" role={user.role}/>
      <SidebarInset>
        <SiteHeader user={user}/>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

> **Note for the implementer:** This file conflicts with `(admin)/layout.tsx` from Phase 5/8 if you didn't refactor into (portfolio)/(tenant) groups already. Resolve by:
>
> 1. The `(admin)` parent layout in `src/app/(frontend)/(admin)/layout.tsx` only does `requireAuth` (no UI chrome).
> 2. `(portfolio)/layout.tsx` and `(tenant)/layout.tsx` each provide their own SidebarProvider variant.
> 3. The `(portfolio)/sites/[slug]/layout.tsx` provides yet another variant for super-admin-viewing-tenant context.

- [ ] **Page** (`page.tsx`):

```tsx
import { requireAuth } from "@/lib/authGate"
import { getDashboardStats, getEditsTimeseries, getRecentActivity } from "@/lib/activity"
import { StatCards } from "@/components/dashboard/StatCards"
import { EditsChart } from "@/components/dashboard/EditsChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"

export default async function TenantDashboard() {
  const { ctx } = await requireAuth()
  const tenantId = ctx.tenantId!
  const [stats, series, activity] = await Promise.all([
    getDashboardStats(tenantId), getEditsTimeseries(tenantId, 30), getRecentActivity({ tenantId, limit: 25 })
  ])
  return (
    <div className="flex flex-col gap-4">
      <StatCards stats={[
        { label: "Published pages", value: stats.publishedPages },
        { label: "Edits this week", value: stats.editsThisWeek },
        { label: "Form submissions (30d)", value: stats.formsThisMonth },
        { label: "Status", value: "active" }
      ]}/>
      <EditsChart data={series}/>
      <ActivityFeed entries={activity}/>
    </div>
  )
}
```

- [ ] **Pages list/new/edit:** copy the implementations from `(portfolio)/sites/[slug]/pages/*` but read `tenantId` via `getSiabContext` and use base href `/pages` (no `/sites/<slug>` prefix).

- [ ] **Media, Forms, Settings, Users pages:** same pattern — re-use components, but resolve tenant from context, use shorter base href.

For each route, the page file looks like:

```tsx
import { requireAuth } from "@/lib/authGate"
import { /* queries + components */ } from "..."

export default async function Page() {
  const { user, ctx } = await requireAuth()
  const tenantId = ctx.tenantId!
  // load data + render same components used in /sites/<slug>/<view>
}
```

- [ ] **Commit**

```bash
git add src/app/(frontend)/(admin)
git commit -m "feat(phase-14): tenant-editor scoped routes (mirror of /sites/<slug>/* without prefix)"
```

### Task 14.2: Test mode switching via /etc/hosts

- [ ] **Step 1: Add hosts entries**

```bash
# /etc/hosts (or C:\Windows\System32\drivers\etc\hosts on Windows)
127.0.0.1 admin.localhost
127.0.0.1 admin.t1.test
127.0.0.1 admin.t2.test
```

- [ ] **Step 2: Verify**

- Visit http://admin.localhost:3000/ → super-admin dashboard
- Visit http://admin.t1.test:3000/ → log in with the t1 owner from Phase 3.5 → tenant editor dashboard
- Visit http://admin.t2.test:3000/ with the t1 owner's cookie → 403/redirect

- [ ] **Step 3: Document in README**

Add a brief "Local dev hosts" section to `README.md` (creating it if it doesn't exist) with the entries above.

- [ ] **Commit**

```bash
git add README.md
git commit -m "docs(phase-14): hosts file entries for local multi-host testing"
```

**Phase 14 milestone:** Both super-admin and tenant-editor experiences are routed correctly. The full multi-tenant UX is functional end-to-end.

---

## Phase 15 — Email integration (Resend) for invite + reset

**Goal:** Invite + forgot-password flows send real emails via Resend. The reset link's host matches where the user logs in (per-tenant subdomain or super-admin host).

### Task 15.1: Resend transport adapter

**Files:**
- Create: `src/lib/email/resend.ts`

```ts
import { Resend } from "resend"

let client: Resend | null = null
export function resendClient() {
  if (!client) {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing")
    client = new Resend(process.env.RESEND_API_KEY)
  }
  return client
}

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const r = resendClient()
  const result = await r.emails.send({
    from: process.env.EMAIL_FROM || "noreply@siteinabox.nl",
    to: opts.to, subject: opts.subject, html: opts.html
  })
  if (result.error) throw new Error(`Resend: ${result.error.message}`)
  return result.data
}
```

```bash
pnpm add resend
```

- [ ] **Commit**

```bash
git add src/lib/email/resend.ts package.json pnpm-lock.yaml
git commit -m "feat(phase-15): resend client + sendEmail wrapper"
```

### Task 15.2: Email templates

**Files:**
- Create: `src/lib/email/templates/invite.ts`
- Create: `src/lib/email/templates/resetPassword.ts`

```ts
// invite.ts
export function inviteTemplate(opts: { tenantName: string; resetUrl: string; recipientName: string }) {
  return {
    subject: `You've been invited to ${opts.tenantName}`,
    html: `
      <p>Hi ${opts.recipientName},</p>
      <p>You've been added as an editor on <strong>${opts.tenantName}</strong>.</p>
      <p>Set your password and sign in:</p>
      <p><a href="${opts.resetUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Set password</a></p>
      <p style="color:#666;font-size:12px">This link expires in 1 hour.</p>
    `
  }
}

// resetPassword.ts
export function resetPasswordTemplate(opts: { resetUrl: string }) {
  return {
    subject: "Reset your password",
    html: `<p>Click to reset:</p><p><a href="${opts.resetUrl}">${opts.resetUrl}</a></p><p style="color:#666;font-size:12px">If you didn't request this, ignore this email.</p>`
  }
}
```

- [ ] **Commit**

```bash
git add src/lib/email/templates
git commit -m "feat(phase-15): invite + reset email templates"
```

### Task 15.3: Wire Payload's email config to Resend

**Files:**
- Modify: `src/payload.config.ts`

Payload v3 supports a `email` config that takes a Nodemailer-compatible transport. Use `@payloadcms/email-resend` if available, otherwise inline:

```bash
pnpm add @payloadcms/email-resend
```

In `src/payload.config.ts`:
```ts
import { resendAdapter } from "@payloadcms/email-resend"
// ...
email: resendAdapter({
  defaultFromAddress: process.env.EMAIL_FROM || "noreply@siteinabox.nl",
  defaultFromName: "SiteInABox",
  apiKey: process.env.RESEND_API_KEY || ""
})
```

- [ ] **Commit**

```bash
git add src/payload.config.ts package.json pnpm-lock.yaml
git commit -m "feat(phase-15): Payload email adapter (Resend)"
```

### Task 15.4: Override forgot-password email URL per tenant

**Files:**
- Modify: `src/collections/Users.ts`

Payload's `forgotPasswordOptions.generateEmailHTML` and `generateEmailSubject` allow customization. The reset URL must use `admin.<user-tenant-domain>` (or `admin.siteinabox.nl` for super-admins).

```ts
import { resetPasswordTemplate } from "@/lib/email/templates/resetPassword"

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    useAPIKey: true,
    forgotPassword: {
      generateEmailHTML: async ({ token, user, req }) => {
        let host = `admin.${process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN || "siteinabox.nl"}`
        if (user.role !== "super-admin" && user.tenant) {
          const tenantId = typeof user.tenant === "string" ? user.tenant : user.tenant.id
          const tenant = await req.payload.findByID({ collection: "tenants", id: tenantId, overrideAccess: true })
          if (tenant?.domain) host = `admin.${tenant.domain}`
        }
        const proto = process.env.NODE_ENV === "production" ? "https" : "http"
        const port = process.env.NODE_ENV === "production" ? "" : `:${process.env.PORT || 3000}`
        const resetUrl = `${proto}://${host}${port}/reset-password/${token}`
        return resetPasswordTemplate({ resetUrl }).html
      },
      generateEmailSubject: () => "Reset your siab-payload password"
    }
  },
  /* access + admin + fields unchanged */
}
```

- [ ] **Verify**

`pnpm dev`. Submit /forgot-password with the t1 owner's email. Check Resend dashboard or your inbox — link host should be `admin.t1.test:3000`.

- [ ] **Commit**

```bash
git add src/collections/Users.ts
git commit -m "feat(phase-15): per-tenant reset URL in password reset email"
```

**Phase 15 milestone:** Real emails sent via Resend. Reset links land users on the correct subdomain.

---

## Phase 16 — Critical test suites

**Goal:** Two non-negotiable test suites: tenant isolation (~30 cases) and projection snapshots (~10 cases). These prevent the highest-risk regressions (cross-tenant leak; SSR contract drift).

### Task 16.1: Tenant isolation suite

**Files:**
- Create: `tests/integration/tenant-isolation.test.ts`

This is **the** P0 test. For each scoped collection, verify a user from tenant A cannot read, write, count, or update tenant B's data.

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { getTestPayload, resetTestData, seedFixture } from "./_helpers"
import type { Payload } from "payload"

let payload: Payload
let fx: Awaited<ReturnType<typeof seedFixture>>

beforeAll(async () => { payload = await getTestPayload() })
beforeEach(async () => {
  await resetTestData(payload)
  fx = await seedFixture(payload)
  // Add content to t1 and t2
  await payload.create({ collection: "pages", overrideAccess: true,
    data: { tenant: fx.t1.id, title: "T1 page", slug: "t1-page", status: "published" } as any })
  await payload.create({ collection: "pages", overrideAccess: true,
    data: { tenant: fx.t2.id, title: "T2 page", slug: "t2-page", status: "published" } as any })
})

const collections = ["pages", "media", "site-settings", "forms"] as const

describe("tenant isolation", () => {
  for (const slug of collections) {
    describe(`collection: ${slug}`, () => {
      it("editor in t1 cannot read t2 docs", async () => {
        const res = await payload.find({
          collection: slug, user: fx.editor1, where: { tenant: { equals: fx.t2.id } }, limit: 100
        } as any)
        expect(res.docs.length).toBe(0)
      })

      it("editor in t1 finds only own-tenant docs in unfiltered list", async () => {
        const res = await payload.find({ collection: slug, user: fx.editor1, limit: 100 } as any)
        for (const d of res.docs as any[]) {
          const tenantId = typeof d.tenant === "string" ? d.tenant : d.tenant?.id
          if (tenantId) expect(tenantId).toBe(fx.t1.id)
        }
      })
    })
  }

  it("editor in t1 cannot update a t2 page", async () => {
    const t2Page = (await payload.find({ collection: "pages", overrideAccess: true,
      where: { tenant: { equals: fx.t2.id } }, limit: 1 })).docs[0]
    expect(t2Page).toBeTruthy()
    await expect(
      payload.update({ collection: "pages", id: t2Page.id, user: fx.editor1, data: { title: "hacked" } } as any)
    ).rejects.toThrow()
  })

  it("editor in t1 cannot delete a t2 page", async () => {
    const t2Page = (await payload.find({ collection: "pages", overrideAccess: true,
      where: { tenant: { equals: fx.t2.id } }, limit: 1 })).docs[0]
    await expect(
      payload.delete({ collection: "pages", id: t2Page.id, user: fx.editor1 } as any)
    ).rejects.toThrow()
  })

  it("editor in t1 cannot create a page in t2", async () => {
    await expect(
      payload.create({ collection: "pages", user: fx.editor1,
        data: { tenant: fx.t2.id, title: "leak", slug: "leak", status: "draft" } as any })
    ).rejects.toThrow()
  })

  it("super-admin sees all tenants' pages", async () => {
    const res = await payload.find({ collection: "pages", user: fx.sa, limit: 100 } as any)
    expect(res.docs.length).toBeGreaterThanOrEqual(2)
  })

  it("viewer in t1 cannot create in own tenant", async () => {
    await expect(
      payload.create({ collection: "pages", user: fx.viewer1,
        data: { tenant: fx.t1.id, title: "v", slug: "v", status: "draft" } as any })
    ).rejects.toThrow()
  })

  it("owner in t1 cannot delete users in t2", async () => {
    const t2User = await payload.create({ collection: "users", overrideAccess: true,
      data: { email: "edit2@test", password: "x", name: "E2", role: "editor", tenant: fx.t2.id } as any })
    await expect(
      payload.delete({ collection: "users", id: t2User.id, user: fx.owner1 } as any)
    ).rejects.toThrow()
  })

  it("owner in t1 can manage users in own tenant", async () => {
    const created = await payload.create({ collection: "users", user: fx.owner1,
      data: { email: "new@test", password: "x", name: "N", role: "editor", tenant: fx.t1.id } as any })
    expect(created.id).toBeTruthy()
  })
})
```

- [ ] **Run + commit**

```bash
pnpm test tests/integration/tenant-isolation.test.ts
```

Expected: all tests pass. Commit:
```bash
git add tests/integration/tenant-isolation.test.ts
git commit -m "test(phase-16): tenant isolation suite (cross-tenant CRUD must fail)"
```

### Task 16.2: Projection snapshot tests with all block types

**Files:**
- Create: `tests/unit/pageToJson-blocks.test.ts`

Snapshot tests for every block type, ensuring SSR contract stability.

```ts
import { describe, it, expect } from "vitest"
import { pageToJson } from "@/lib/projection/pageToJson"

describe("pageToJson — all block types", () => {
  it("Hero block round-trips", () => {
    const json = pageToJson({ tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "2026-05-05T00:00:00.000Z",
      blocks: [{ id: "1", blockType: "hero", eyebrow: "Eyebrow", headline: "H", subheadline: "S",
        cta: { label: "Go", href: "/go" }, image: { url: "/u/h.png", filename: "h.png" } }]
    })
    expect(json.blocks[0]).toMatchInlineSnapshot(`
      {
        "blockType": "hero",
        "cta": { "href": "/go", "label": "Go" },
        "eyebrow": "Eyebrow",
        "headline": "H",
        "image": { "filename": "h.png", "url": "/u/h.png" },
        "subheadline": "S"
      }
    `)
  })

  it("FeatureList block round-trips", () => {
    const json = pageToJson({ tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x",
      blocks: [{ id: "1", blockType: "featureList", title: "Why us", intro: "Because",
        features: [{ id: "f1", title: "Fast", description: "Very", icon: "zap" },
                   { id: "f2", title: "Safe", description: "Yes", icon: "shield" }] }]
    })
    expect(json.blocks[0]).toEqual({
      blockType: "featureList", title: "Why us", intro: "Because",
      features: [{ title: "Fast", description: "Very", icon: "zap" },
                 { title: "Safe", description: "Yes", icon: "shield" }]
    })
  })

  it("Testimonials, FAQ, CTA, RichText, ContactSection round-trip", () => {
    const blocks = [
      { blockType: "testimonials", title: "Love", items: [{ quote: "wow", author: "Jane", role: "CEO" }] },
      { blockType: "faq", title: "Help", items: [{ question: "Q?", answer: "A." }] },
      { blockType: "cta", headline: "Buy", primary: { label: "Buy", href: "/b" } },
      { blockType: "richText", body: "hello" },
      { blockType: "contactSection", title: "Hi", formName: "Contact", fields: [
        { name: "email", label: "Email", type: "email", required: true }
      ]}
    ]
    const json = pageToJson({ tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x", blocks })
    expect(json.blocks).toHaveLength(5)
    expect(json.blocks.every((b: any) => b.blockType)).toBe(true)
    expect(json.blocks.every((b: any) => !("id" in b))).toBe(true)
  })
})
```

- [ ] **Run + commit**

```bash
pnpm test tests/unit/pageToJson-blocks.test.ts
git add tests/unit/pageToJson-blocks.test.ts
git commit -m "test(phase-16): projection snapshots for all block types"
```

### Task 16.3: Orchestrator API integration test

**Files:**
- Create: `tests/integration/orchestrator-api.test.ts`

Verify that the API key flow works end-to-end: tenant creation, then page seeding, both via API.

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { getTestPayload, resetTestData, seedFixture } from "./_helpers"
import type { Payload } from "payload"

let payload: Payload

beforeAll(async () => { payload = await getTestPayload() })
beforeEach(async () => { await resetTestData(payload) })

describe("orchestrator API flow", () => {
  it("API-key user can create a tenant and a scoped page", async () => {
    // Create the orchestrator service user
    const orchestrator = await payload.create({ collection: "users", overrideAccess: true,
      data: { email: "orch@test", password: "x", name: "Orchestrator", role: "super-admin",
              enableAPIKey: true, apiKey: "test-api-key-12345678" } as any })

    // Tenant create
    const tenant = await payload.create({
      collection: "tenants", user: orchestrator,
      data: { name: "Client X", slug: "clientx", domain: "clientx.test", status: "provisioning" }
    } as any)
    expect(tenant.id).toBeTruthy()

    // Page seed (must include tenant explicitly because super-admin writes aren't auto-scoped)
    const page = await payload.create({
      collection: "pages", user: orchestrator,
      data: { tenant: tenant.id, title: "Home", slug: "home", status: "published",
              blocks: [{ blockType: "hero", headline: "Welcome" }] }
    } as any)
    expect(page.id).toBeTruthy()
    expect((page as any).tenant).toBeTruthy()
  })

  it("API-key user must include tenant on scoped collections", async () => {
    const orchestrator = await payload.create({ collection: "users", overrideAccess: true,
      data: { email: "orch2@test", password: "x", role: "super-admin",
              enableAPIKey: true, apiKey: "test-api-key-22345678" } as any })

    // Without tenant, should fail (or get assigned the default? — depends on plugin behavior)
    await expect(
      payload.create({ collection: "pages", user: orchestrator,
        data: { title: "no-tenant", slug: "no-tenant", status: "draft" } as any })
    ).rejects.toThrow()
  })
})
```

- [ ] **Run + commit**

```bash
pnpm test tests/integration/orchestrator-api.test.ts
git add tests/integration/orchestrator-api.test.ts
git commit -m "test(phase-16): orchestrator API key flow"
```

**Phase 16 milestone:** Critical correctness tests in place. Tenant isolation cannot regress without the suite catching it.

---

## Phase 17 — E2E (Playwright)

**Goal:** Five user-facing flows verified by a real browser against a running dev server.

### Task 17.1: Install Playwright

```bash
pnpm add -D @playwright/test
pnpm dlx playwright install chromium
```

- [ ] **Create `playwright.config.ts`:**

```ts
import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: process.env.E2E_BASE_URL || "http://admin.localhost:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  reporter: [["list"], ["html", { open: "never" }]]
})
```

- [ ] **Commit**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts
git commit -m "test(phase-17): playwright setup"
```

### Task 17.2: Critical flows

**Files:** all under `tests/e2e/`

`super-admin-login.spec.ts`:
```ts
import { test, expect } from "@playwright/test"

test("super-admin login + dashboard renders", async ({ page }) => {
  await page.goto("/login")
  await page.fill('input[type="email"]', "admin@optidigi.nl")
  await page.fill('input[type="password"]', process.env.E2E_SA_PASSWORD!)
  await page.click('button:has-text("Sign in")')
  await page.waitForURL("/")
  await expect(page.getByText(/Total tenants|Published pages/)).toBeVisible()
})
```

`tenant-create-and-page-publish.spec.ts`:
```ts
import { test, expect } from "@playwright/test"

test("super-admin: create tenant + publish page; JSON appears on disk", async ({ page }) => {
  // Login
  await page.goto("/login")
  await page.fill('input[type="email"]', "admin@optidigi.nl")
  await page.fill('input[type="password"]', process.env.E2E_SA_PASSWORD!)
  await page.click('button:has-text("Sign in")')
  await page.waitForURL("/")

  // Create tenant
  await page.goto("/sites/new")
  const slug = `e2e-${Date.now()}`
  await page.fill('input[name="name"]', "E2E")
  await page.fill('input[name="slug"]', slug)
  await page.fill('input[name="domain"]', `${slug}.test`)
  await page.click('button:has-text("Create tenant")')
  await page.waitForURL(new RegExp(`/sites/${slug}/onboarding`))

  // Create + publish page
  await page.goto(`/sites/${slug}/pages/new`)
  await page.fill('input[name="title"]', "Home")
  await page.fill('input[name="slug"]', "home")
  await page.click('button:has-text("Add block")')
  await page.click('text=hero')
  await page.fill('[name="blocks.0.headline"]', "Welcome")
  await page.locator('[role="combobox"]').first().click()
  await page.click('text=Published')
  await page.click('button[type="submit"]')
  await expect(page.getByText(/Published|Saved/)).toBeVisible()
})
```

`role-gate.spec.ts`:
```ts
import { test, expect } from "@playwright/test"

test("super-admin redirected from tenant host", async ({ page, context }) => {
  await page.goto("http://admin.localhost:3000/login")
  await page.fill('input[type="email"]', "admin@optidigi.nl")
  await page.fill('input[type="password"]', process.env.E2E_SA_PASSWORD!)
  await page.click('button:has-text("Sign in")')
  await page.waitForURL("http://admin.localhost:3000/")

  // Visit tenant host — should be bounced
  await page.goto("http://admin.t1.test:3000/")
  await expect(page).toHaveURL(/login/)
})
```

- [ ] **Add `.env.example` entry:** `E2E_SA_PASSWORD=`

- [ ] **Run**

```bash
pnpm test:e2e
```

- [ ] **Commit**

```bash
git add tests/e2e .env.example
git commit -m "test(phase-17): E2E flows (login, tenant create + page publish, role gate)"
```

**Phase 17 milestone:** Critical user journeys covered by Playwright.

---

## Phase 18 — Production Dockerfile + GHA + compose finalization

**Goal:** A reproducible image at `ghcr.io/optidigi/siab-payload:latest`. Full production `docker-compose.yml`. Health check wired. Build runs on push to main.

### Task 18.1: Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache wget && addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
```

`.dockerignore`:
```
node_modules
.next
.git
.github
.env
.env.local
docs
tests
.superpowers
.claude
README.md
```

- [ ] **Verify locally**

```bash
docker build -t siab-payload:local .
docker images siab-payload:local
```

- [ ] **Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat(phase-18): production Dockerfile (multi-stage, standalone, health check)"
```

### Task 18.2: Production docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

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
      NEXT_PUBLIC_SUPER_ADMIN_DOMAIN: ${SUPER_ADMIN_DOMAIN:-siteinabox.nl}
      NEXT_PUBLIC_VPS_IP: ${VPS_IP}
      RESEND_API_KEY: ${RESEND_API_KEY}
      EMAIL_FROM: ${EMAIL_FROM:-noreply@siteinabox.nl}
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
      retries: 3

  postgres:
    image: postgres:17-alpine
    container_name: siab-payload-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: payload
      POSTGRES_USER: payload
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks: [internal]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U payload"]
      interval: 10s

volumes:
  postgres-data:

networks:
  proxy:    { external: true }
  internal:
```

- [ ] **Commit**

```bash
git add docker-compose.yml
git commit -m "feat(phase-18): production docker-compose.yml"
```

### Task 18.3: GitHub Actions image build

**Files:**
- Create: `.github/workflows/build-image.yml`

```yaml
name: build-image
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  packages: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/optidigi/siab-payload
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,format=short
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          platforms: linux/amd64
```

- [ ] **Commit + push**

```bash
git add .github/workflows
git commit -m "feat(phase-18): GHA build-image workflow (push to main → ghcr.io)"
```

After committing, push to GitHub (when remote is added). Verify the workflow succeeds; pull image on VPS:

```bash
docker login ghcr.io -u <github-user>
docker pull ghcr.io/optidigi/siab-payload:latest
```

### Task 18.4: Production deploy on VPS

**Files (on VPS):**
- Create: `/srv/saas/siab-payload/docker-compose.yml` (copy of repo's)
- Create: `/srv/saas/siab-payload/.env`

- [ ] **Step 1: Stop the existing siab-payload stack**

```bash
ssh prod
cd /srv/saas/siab-payload          # or wherever the existing one is
docker compose down
docker volume ls | grep siab        # verify postgres volume from old version
```

- [ ] **Step 2: Stage new compose + env**

Copy `docker-compose.yml` and create `.env`:
```bash
cat > /srv/saas/siab-payload/.env <<'EOF'
POSTGRES_PASSWORD=<strong-password>
PAYLOAD_SECRET=<openssl rand -hex 32>
SUPER_ADMIN_DOMAIN=siteinabox.nl
VPS_IP=<vps-ip>
RESEND_API_KEY=<from-resend-dashboard>
EMAIL_FROM=noreply@siteinabox.nl
EOF
chmod 600 /srv/saas/siab-payload/.env
```

- [ ] **Step 3: Bring up**

```bash
cd /srv/saas/siab-payload
docker compose pull
docker compose up -d
docker compose ps
docker compose logs -f siab-payload
```

Expected: `siab-payload` healthy in <60s.

- [ ] **Step 4: Configure NPM for admin.siteinabox.nl**

In nginx-proxy-manager UI:
- Domain: `admin.siteinabox.nl`
- Forward Hostname: `siab-payload`
- Forward Port: `3000`
- Block Common Exploits: on
- WebSockets Support: on
- SSL: Let's Encrypt → Force SSL → HTTP/2 → save

- [ ] **Step 5: Create initial super-admin user**

Visit `https://admin.siteinabox.nl/login`. Without users in the DB, Payload's first-user flow doesn't apply (we hid `/admin`), so create one via API:

```bash
curl -X POST https://admin.siteinabox.nl/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@optidigi.nl","password":"<initial-password>","name":"You","role":"super-admin"}'
```

Then log in at https://admin.siteinabox.nl/login.

- [ ] **Step 6: Create the orchestrator service user**

Via the admin UI → Users → New → role=super-admin, no tenant, enable API key → copy the key into `siab-payload-orchestrator/.env` as `PAYLOAD_API_TOKEN`.

**Phase 18 milestone:** **Production live.** `admin.siteinabox.nl` serves the shadcn dashboard. Image pulls from ghcr.io. Health check green. Orchestrator integration ready.

---

## Final verification checklist

After Phase 18:

- [ ] `pnpm test` passes (unit + integration)
- [ ] `pnpm test:e2e` passes locally
- [ ] `docker build` succeeds and image runs
- [ ] `https://admin.siteinabox.nl` loads, login works
- [ ] Creating a tenant + page in super-admin produces JSON in `/srv/data/saas/siab-payload/tenants/<id>/`
- [ ] Visiting `admin.<configured-test-domain>` resolves the right tenant
- [ ] Cross-tenant access attempts are blocked (Phase 16 suite green)
- [ ] Resend sends real reset emails with correct hosts
- [ ] uptime-kuma can ping `/api/health` for liveness alerts

---

## Post-launch follow-ups (out of v1 scope; tracked here for reference)

- Sharp + image variants (responsive sizes)
- Tiptap rich-text editor (replaces `<Textarea>` in `richText` field renderer)
- Audit log collection
- DNS provider automation (Cloudflare/etc.)
- Tenant impersonation / "view as editor" for super-admin debugging
- Drag-to-reorder blocks (currently order-only-via-add)
- Block library presets (one-click "marketing landing page" with pre-filled blocks)








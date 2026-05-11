# Backend Backlog

Canonical source of truth for backend / data-layer / operational items to review or address in future cycles. App + backend scope.

## How this file is used

- **Each entry has a stable ID** (`OBS-N` for items inherited from the 2026-05 audit cycle; new items continue numbering as `OBS-N+1`, `OBS-N+2`, etc., to keep references in git history and elsewhere stable).
- **Entries categorize by status:**
  - `Active` — real concern, deferred for now, review periodically
  - `Latent` — not exploitable today; trigger condition documented; check before enabling the trigger
  - `Audit-deferred` — explicitly punted by audit text; tied to a future feature
  - `Closed` — addressed (typically promoted to a fix batch or PR); kept for lineage with reference to closing batch/branch
- **When something gets discovered** (during an audit, a PR review, an adversarial-review subagent verdict, an operational incident, etc.) that's backend-shaped and not actionable in the discovering work, append it here.
- **When an item is addressed**, move it to the Closed section with a reference to the resolving branch/PR/commit. Do NOT delete — lineage matters.
- **When an item's trigger condition fires** (e.g. a Payload auth feature is enabled, or the deployment scales horizontally), promote the item to an immediate fix batch — see "Suggested fix shape" on each entry for what to do.

## Where these items came from

The 2026-05 audit cycle produced 16 findings across security / operational data integrity / regulatory compliance domains. All 16 were either fully closed by fix batches OR partially closed with documented residuals. During the cycle, 17 out-of-batch observations surfaced — items deliberately not promoted to a fix batch (because they were latent, audit-deferred, or out-of-scope for the discovering batch). Those 17 form the initial backlog content here.

The full audit cycle's working artifacts (threat model, batch reports, adversarial-review verdicts) live in a parallel fixer workspace at `~/Desktop/env/siab-payload-fixer/audits/`. Per-batch reports there reference these `OBS-N` IDs; do not renumber.

## Pairing

Frontend items are tracked at `../frontend/README.md`. Cross-references between `OBS-N` and `FE-N` are encouraged where a root issue spans both domains.

---

## Active observations — real, deferred, review periodically

### OBS-1 — `script-src 'unsafe-inline' 'unsafe-eval'` in admin CSP

**Status:** Active (acceptable today)
**Discovered in:** P1 batch-1 (2026-05 audit cycle)
**T-ID:** T9 / T12
**File:** `src/middleware.ts` `ADMIN_CSP` / `PREVIEW_CSP` constants

#### Description
The admin app's Content-Security-Policy ships with `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. The audit's strawman CSP suggested `script-src 'self'` only. The deviation is required because Next.js App Router emits inline hydration scripts and runtime-eval'd chunks — tightening to `'self'` would break SSR hydration.

#### Why deferred
T9 (stored XSS) is currently Medium-Low because RichText is a plain textarea (`src/blocks/RichText.ts:10` notes Tiptap is v2 future work). With no rich-HTML rendering surface, the `'unsafe-inline' 'unsafe-eval'` permissiveness has nothing to amplify. Closes the audit's primary clickjacking concern (`frame-ancestors 'none'`); leaves the XSS-fallback half dormant.

#### Trigger condition
When Tiptap / Lexical / any other rich-HTML editor lands and stores HTML in the DB. T9 immediately escalates from Low to High. At that point, the CSP must move to nonce-based `script-src 'self' 'nonce-<perRequest>'`.

#### Suggested fix shape (when triggered)
1. Generate a per-request nonce in middleware (already runs per-request).
2. Inject the nonce into Next's `_next/static` script tags via a header or page-level mechanism.
3. Remove `'unsafe-inline' 'unsafe-eval'` from `script-src`; add `'nonce-${nonce}'`.
4. Verify hydration still works — Next 15 has documented patterns for this.

---

### OBS-2 — `/__preview*` reserved CSP branch is dormant but path-active

**Status:** Active (latent surface)
**Discovered in:** P1 batch-1 (2026-05 audit cycle)
**T-ID:** T12
**File:** `src/middleware.ts` `isPreviewPath`, `PREVIEW_CSP`

#### Description
Middleware has a reserved `/__preview*` path branch that applies a more permissive CSP (no `frame-ancestors`, no `X-Frame-Options`) than the admin CSP. Today no routes exist under `/__preview/*` — Next.js renders the closest `not-found.tsx` (404). If a future PR mounts a sensitive page there, it would be served with the looser CSP and be clickjackable.

#### Why deferred
Defensive future-routing structure for the live-preview iframe pattern. Removing the branch would force a future PR to re-introduce CSP path-branching from scratch. Keeping it is fine; the gap is "if someone adds a route here in the future without thinking about CSP."

#### Trigger condition
A PR adds a route under `/__preview/*` that renders authenticated content. PR review must catch this; no automated alert today.

#### Suggested fix shape
Either: (a) add a runtime sanity check that no `/__preview/*` route exists in production, alerting on cold start if one is found; or (b) document this as an architectural rule in CONTRIBUTING.md or similar (any `/__preview/*` route MUST be designed for the preview-iframe context with explicit CSP review).

---

### OBS-4 — DB-cost amplification on bogus `Authorization: users API-Key <random>`

**Status:** Active (low realistic priority, in-scope T4)
**Discovered in:** P1 #5 batch (2026-05 audit cycle)
**T-ID:** T4 (broadly, not in #5 literal scope)
**File:** `node_modules/payload/dist/auth/strategies/apiKey.js:8-21` (the per-request HMAC + DB query)

#### Description
Anonymous attacker sends `Authorization: users API-Key <random>` repeatedly. P1 #5's middleware bypasses (auth signal present); apiKey strategy runs (computes 2 HMACs + 1 indexed DB query); strategy returns `{user: null}`; collection-level gate rejects. End-state: no row written, no email sent, but each request costs ~3 ops on the server. At sustained 10k req/sec: 20k HMAC computations + 10k DB queries per second.

#### Why deferred
Audit finding #5's scope was forms-table bloat + email floods, both closed. This is a different vector (compute amplification) in the same threat family (T4 anonymous abuse). Not an audit finding; surfaced by P1 #5's adversarial review.

#### Trigger condition
If production traffic shows symptoms of this attack (CPU spikes correlated with bogus API-Key requests), or if the orchestrator's tenant count grows enough that legitimate apiKey lookup load is non-trivial.

#### Suggested fix shape
Cheap pre-check before HMAC computation:
- The apiKey strategy could length-bound check the credential (`if (apiKey.length < 16 || apiKey.length > 256) return {user: null}`) to reject obviously-malformed credentials before doing the expensive HMAC + DB query.
- This is upstream Payload code — would need a wrapping strategy or upstream contribution. Alternative: middleware-level filter that rejects `Authorization: users API-Key <X>` requests where `X` doesn't match a basic shape regex.

---

### OBS-5 — Authed-tenant-abuse residual on `/api/users/forgot-password`

**Status:** Active (by design, low realistic priority)
**Discovered in:** P1 #5 batch (2026-05 audit cycle)
**T-ID:** T4 (broadly)
**File:** `src/middleware.ts` rate-limit logic + `src/access/authSignals.ts`

#### Description
P1 #5's rate-limit fix scopes to anonymous-only callers (no `payload-token` cookie AND no `Authorization` header). Authed callers — including malicious editors — bypass the rate-limit. An authed editor could flood `/api/users/forgot-password` with arbitrary victim emails to spam them with reset-password emails.

#### Why deferred
The audit's literal Suggested fix said per-IP rate-limiting. P1 #5 dispatch tightened to anonymous-only-scoping to preserve orchestrator-friendliness (orchestrator authenticates as super-admin and bursts forgot-password during tenant provisioning). Closing the authed-tenant-abuse gap requires JWT decoding in middleware (to distinguish orchestrator from authed-tenant-abuser) — not trivial, and the audit didn't surface this gap.

#### Trigger condition
Observed in practice (an editor or compromised editor account is using this to spam users), OR an audit pass explicitly raises it.

#### Suggested fix shape
Per-user rate-limit on forgot-password (rate-limit by `req.user.id`, not by IP). Decode `payload-token` cookie in middleware OR move rate-limit to the API route handler (after Payload's auth has run). Super-admin still exempt; tenant-roles get a per-account budget. Could also add per-target-email rate-limit (no more than N reset emails per email per hour) as a secondary defense.

---

### OBS-6 — Owner-invite to typo'd email

**Status:** Active (UX + minor confidentiality concern)
**Discovered in:** P1 #7 batch (2026-05 audit cycle)
**T-ID:** None (UX/confidentiality, not security per threat model)
**File:** `src/lib/actions/inviteUser.ts`

#### Description
An owner inviting a team member can typo the email address. The new account is created with that wrong email; the wrong-address recipient receives the reset email and could complete signup as an unintended editor/viewer in the inviter's tenant.

#### Why deferred
Not a takeover of an existing account (no victim user). UX/confidentiality concern. Scope of P1 #7 was the password/session vector specifically.

#### Trigger condition
Operator complaint, or compliance review flags it.

#### Suggested fix shape
Either: (a) require email confirmation by the recipient before the account becomes usable (existing `auth.verify: true` mechanism — see OBS-8); (b) display the invitee email prominently in the invite-success UI so the owner can spot typos immediately; (c) add an "invite revocation" flow so an invitation can be cancelled within N hours.

---

### OBS-7 — `listPages` / `listMedia` / `listForms` cap silently at 50 without pagination UI

**Status:** Active (UX, not security)
**Discovered in:** P2 batch-1 (2026-05 audit cycle)
**T-ID:** None (UX paper-cut)
**File:** `src/lib/queries/{pages,media,forms}.ts` consumers in admin UI pages

#### Description
P2 #13 fix replaced silent `limit: 500` with `findAllPaginated` (for the destructive `getMediaUsage` walker) and `*Paginated` variants for listing queries. The admin pages still call the legacy non-paginated wrappers, which now default to `pageSize: 50`. Tenants with 50–500 docs see only the first 50 in the admin lists with no UI to navigate further.

#### Why deferred
The destructive vector (mediaUsage walker → media-delete UI) is correctly fixed (full walk). The listing UI cap is a UX regression but NOT a security vector. Wiring pagination UI in admin pages is product/UX work outside P2 #13's literal scope.

#### Trigger condition
Tenant has >50 pages/media/forms and an operator reports inability to navigate beyond the first 50 in the admin UI.

#### Suggested fix shape
Add page/pageSize URL params in the admin list pages (`src/app/(admin)/sites/[slug]/{pages,media,forms}/page.tsx`). Wire shadcn Pagination component. Total pages count comes from `*Paginated` variants which already return `totalDocs` / `totalPages`. ~30 lines per list page.

> May overlap with the frontend backlog when wired — the UX surface lives in admin pages. Cross-reference any FE-N entry that's added.

---

### OBS-13 — i18n fallback-language trapdoor on `getOrCreateSiteSettings` race detection

**Status:** Active (forward-compat trapdoor — would migrate to Latent if i18n config is locked-down)
**Discovered in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** T8 (would re-arm finding #11's race-loss path)
**File:** `src/lib/queries/settings.ts` `isUniqueViolation` channel 1

#### Description
The `isUniqueViolation` detector in `getOrCreateSiteSettings` includes a channel that matches against `req.t('error:valueMustBeUnique')`. Today `payload.config.ts` has no `i18n` block, so `t` defaults to English and the comparison `=== "Value must be unique"` works. If a future PR adds `i18n: { fallbackLanguage: 'nl', supportedLanguages: { nl } }` (or any non-English fallback), `req.t('error:valueMustBeUnique')` returns the translated string (e.g. Dutch `'De waarde moet uniek zijn'`) and channel 1 silently degrades. Channels 2 and 3 (`.code === '23505'` / pg-style message regex) also don't fire because Payload's drizzle adapter strips the pg error shape. Race-loser surfaces a 400 again — same vector finding #11 was filed to close.

#### Why deferred
Not currently exploitable — `payload.config.ts` doesn't enable i18n. Same class as the graphql-playground default-trapdoor finding (P3 #16) — relying on a Payload default that a future PR could flip without realizing the security implication.

#### Trigger condition
Anyone enables i18n in `payload.config.ts` with a non-English fallback. Add this to the i18n-enabling PR's review checklist.

#### Suggested fix shape (when triggered, OR as preventive forward-compat)
In `isUniqueViolation` channel 1, additionally accept any first-error whose `path === "tenant"`. The `path` field is set from `adapter.fieldConstraints` at `node_modules/.../drizzle/dist/upsertRow/handleUpsertError.js:14-26` and is **language-invariant**:

```ts
if (err instanceof ValidationError && err.data?.errors?.[0]?.path === "tenant") return true
```

Could be shipped today as a preventive forward-compat fix; was deliberately scoped out of the discovering batch to avoid out-of-scope creep on an already-Survives finding.

---

### OBS-14 — `tenantLifecycle.createTenantDir` writes empty manifest unsynchronized

**Status:** Active (outside #12 literal scope; theoretical race window)
**Discovered in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/hooks/tenantLifecycle.ts:19` (one-shot empty-manifest write at tenant create)

#### Description
`tenantLifecycle.createTenantDir` runs in `Tenants.afterChange[create]` and writes an empty initial manifest. This write does NOT go through the per-tenant mutex that P2 #12 added for `projectToDisk` writes. If a tenant's first content publish raced with `createTenantDir`, the empty-manifest write could clobber the first projection entry.

#### Why deferred
Audit finding #12's literal scope listed only `manifest.ts:11-35` and `projectToDisk.ts:18-95`. The race is **practically infeasible**: `createTenantDir` runs synchronously in the tenant-create response cycle and completes before the user receives the response. The user must then: navigate to the new tenant's admin, log in, create content, publish. That sequence takes seconds-to-minutes; `createTenantDir` is millis. The races just don't overlap in practice.

#### Trigger condition
A future change makes tenant creation asynchronous (e.g., a job-queue-based provisioning flow), OR an operational pattern emerges where a publish can fire concurrently with tenant create.

#### Suggested fix shape
Wrap the `createTenantDir` write with the same `withManifestMutex` helper P2 #12 added. One-line change. Defer until the trigger fires; don't fix preemptively.

---

### OBS-15 — `writeAtomic` leaks `.tmp.<pid>.<ts>` files on `writeFile` / `fsync` failure

**Status:** Active (housekeeping, not security)
**Discovered in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** None (operational hygiene)
**File:** `src/lib/atomicWrite.ts`

#### Description
`writeAtomic` writes to a temp file (`<target>.tmp.<pid>.<ts>`) and then `fs.rename`s atomically. If `writeFile` or `fsync` fails (disk full, permissions, etc.), the `finally` closes the handle but does NOT `unlink` the temp file. Over time, failed writes accumulate `.tmp.*` debris in the manifest directories.

#### Why deferred
No security impact — readers always read the canonical filename, never the temp variants. Just disk hygiene. Not in audit scope.

#### Trigger condition
Operator notices accumulation of `.tmp.*` files in manifest directories. Not currently a known production issue.

#### Suggested fix shape
Add `await unlink(tmpPath).catch(() => {})` to the error path of `writeAtomic`'s try/catch (not the success path — successful writes have already renamed the temp file away). The `.catch(() => {})` is intentional: if the unlink itself fails (already-gone, permissions, etc.) we've already failed the write and don't want to mask that with a secondary error.

---

### OBS-17 — `media.filename` cross-tenant rename leak persists post-#15 (Payload upstream `getSafeFileName` runs before the new hook)

**Status:** Active (residual exposure on partially-closed P3 #15) · **Largest open architectural item**
**Discovered in:** P3 batch (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/collections/Media.ts` · `src/hooks/projectToDisk.ts:71-110` · `node_modules/payload/dist/uploads/getSafeFilename.js:46-58` · `node_modules/payload/dist/uploads/docWithFilenameExists.js:1-18` · `node_modules/payload/dist/collections/operations/create.js:79 vs :107`

#### Description
Audit finding #15's prescribed two-layer fix (compound `(tenant_id, filename)` UNIQUE INDEX + `ensureUniqueTenantFilename` beforeValidate hook) closes the schema-level half of the finding but does NOT close the audit's headline exploit. Payload's upstream upload pipeline calls `getSafeFileName` BEFORE collection `beforeValidate` hooks run (`create.js:79` runs `generateFileData` which renames; `create.js:107` runs `beforeValidate` hooks). `getSafeFileName` calls `docWithFilenameExists` with NO tenant filter:

```js
const where = { filename: { equals: filename } };  // no tenant scope
```

So when Tenant B uploads `logo.png` while Tenant A already has a media row with that filename, Payload increments to `logo-1.png` BEFORE the new hook runs. The hook sees `data.filename === "logo-1.png"` for tenant B, finds no per-tenant collision, and accepts. Tenant B's API response carries `filename:"logo-1.png"` — leaking that Tenant A has `logo.png`.

#### Why deferred
The proper closure requires architectural rework that exceeded the P3 batch's two-layer fix scope. Four candidate fixes were evaluated and three were disqualifying:
1. Per-tenant `staticDir` so the FS check naturally scopes — requires URL routing rework. **Suggested approach** (see below).
2. Custom upload handler that bypasses or scopes `getSafeFileName` — requires monkey-patching Payload internals or maintaining a fork.
3. `overwriteExistingFiles: true` on Media's upload — would short-circuit `getSafeFileName`, but the shared `_uploads-tmp/` staticDir means concurrent same-filename uploads from two tenants race in the temp dir. Introduces a Tenant-user-exploitable cross-tenant data corruption window WORSE than the original P3 leak. NOT a viable shortcut.
4. Filename namespace prefix (e.g. `t<id>_logo.png` stored, `logo.png` displayed) — changes user-visible URL paths and admin identifiers; substantial UI accommodation needed.

The DB-level half (the migration) IS land-able cleanly and is structurally correct — it permits per-tenant filename uniqueness at the schema level and forecloses any non-pipeline write path (e.g. direct DB inserts, future custom routes) from creating cross-tenant duplicates. The remaining leak is via Payload's upstream pipeline behavior. Severity remains Low (the leak reveals filename existence, not file content) so deferral is consistent with the original P3 priority.

#### Trigger condition
Either (a) the deployment ever needs to lift the rename behavior to support legitimate same-filename uploads across tenants (e.g. branding assets each tenant calls `logo.png`), OR (b) a future audit pass re-flags this with elevated severity, OR (c) operational complaints surface ("Tenant B uploaded `logo.png` and the file got renamed").

#### Suggested fix shape
Implement option 1: rework the Media upload+serve pipeline to use a per-tenant on-disk path. Concretely: replace `_uploads-tmp/<filename>` with `_uploads-tmp/<tenantId>/<filename>` and update the URL serving handler to read from the tenant-scoped path. This requires:
- Custom Next.js route handler for `/api/media/file/<filename>` that resolves the requesting tenant from the host (using existing `hostToTenant.ts`) and reads from `_uploads-tmp/<tenantId>/<filename>`.
- Migration of existing on-disk files into per-tenant subdirectories.
- Update `projectMediaToDisk` to write to the new path shape.
- Set `overwriteExistingFiles: true` once the per-tenant dir partition removes the cross-tenant file collision.

**Effort:** M-L. **Risk:** Needs-care (URL change, fileserve change, on-disk migration). The audit's literal text already acknowledged this as the proper closure path.

---

### OBS-18 — CSP `unsafe-inline` / `unsafe-eval` not tightened to nonces

**Status:** Active
**Discovered in:** audit-p1 batch 4 (documented deviation); surfaced as open item 2026-05-11
**File:** `src/middleware.ts` — `ADMIN_CSP` and `PREVIEW_CSP` constants

#### Description
Both CSP strings use `'unsafe-inline'` on `script-src` and `style-src`, and `'unsafe-eval'` on `script-src`. The audit's strawman CSP called for nonces; the shipped version uses the blanket unsafe flags as a documented deviation because Next.js App Router emits inline hydration scripts and runtime-eval'd chunks that can't be controlled without per-request nonce injection. `applySecurityHeaders` was intentionally left as a single call-site so nonce plumbing lands in one place when attempted.

#### Why deferred
Nonce injection in Next.js App Router requires middleware to generate a nonce, pass it via a header/cookie, and have every `<script>` tag in the RSC tree consume it. Non-trivial wiring; accepted as a deferred hardening step in the original audit.

#### Suggested fix shape
1. Generate a per-request nonce in `middleware.ts` (`crypto.randomUUID()` or `crypto.randomBytes(16).toString('base64')`).
2. Replace `'unsafe-inline'` with `'nonce-${nonce}'` in `script-src`.
3. Pass the nonce to the app via a response header (e.g. `x-csp-nonce`).
4. Read it in the root layout and inject `<script nonce={nonce}>` on all inline scripts. Next.js 15 supports `headers()` in server components to read this.
5. `style-src 'unsafe-inline'` is harder — Tailwind v4 runtime CSS requires it unless you switch to a build-time-only approach.

---

### OBS-19 — Integration and unit tests do not run in CI

**Status:** Active
**Discovered in:** Session 2026-05-11 — review of `.github/workflows/ci.yml`
**File:** `.github/workflows/ci.yml`

#### Description
CI runs only `pnpm typecheck` and `pnpm registry:check`. The Vitest unit suite (`tests/unit/`) and integration suite (`tests/integration/`) never run automatically on push or PR. A regression in access control, auth logic, or projection can merge to `main` without any automated signal.

#### Why deferred
Integration tests require a live Postgres instance. Adding one to GHA needs a `services: postgres` container block and `DATABASE_URI` wiring. Not complex but not done.

#### Suggested fix shape
Add a second job to `ci.yml` after `typecheck-and-registry-drift`:

```yaml
test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:17-alpine
      env:
        POSTGRES_USER: payload
        POSTGRES_PASSWORD: ci-password
        POSTGRES_DB: payload
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 5432:5432
  steps:
    - uses: actions/checkout@v5
    - uses: pnpm/action-setup@v4
      with: { version: 10.28.2 }
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm test
      env:
        PAYLOAD_SECRET: ci-test-secret
        DATABASE_URI: postgres://payload:ci-password@localhost:5432/payload
```

The test setup overrides `DATABASE_URI` to `payload_test` automatically — the Postgres service just needs to exist so the override can connect.

---

### OBS-20 — Navigation management buried in settings (needs sidebar page + Pages collection field)

**Status:** Active
**Discovered in:** GitHub #17 (split part A)
**File:** `src/app/(frontend)/(admin)/sites/[slug]/settings/`, `src/collections/SiteSettings.ts`

#### Description
Header/footer navigation is currently edited under Settings → Navigation, which is unintuitive. It should be a first-class page in the sidebar nav. This is part A of the split; part B (auto-add toggle on page create) is OBS-21.

#### Why deferred
Requires a new sidebar route, a navigation to the page, and possibly restructuring how nav items are stored in `SiteSettings`.

#### Suggested fix shape
1. Add a `/sites/[slug]/navigation` route that renders nav management UI.
2. Wire it into `AppSidebar` as a first-class item.
3. Review whether the nav fields in `SiteSettings` need restructuring to support this view cleanly.

---

### OBS-21 — Page create: toggle to auto-include page in header/footer nav

**Status:** Active
**Discovered in:** GitHub #17 (split part B)
**File:** `src/collections/Pages.ts`, `src/components/forms/PageForm.tsx`

#### Description
When creating or editing a page, there should be separate toggles for "Include in header nav" and "Include in footer nav". Currently the user must go to Settings → Navigation manually after creating a page. This is part B of the split from GitHub #17.

#### Why deferred
Requires new boolean fields on the `Pages` collection + a migration + frontend toggle UI in the page form. Depends on OBS-20 for the overall nav management model to be settled first.

#### Suggested fix shape
1. Add `includeInHeader: boolean` and `includeInFooter: boolean` fields to the `Pages` collection.
2. Run `pnpm payload migrate:create pages-nav-toggles`.
3. Add toggle switches to `PageForm.tsx` in a nav/visibility section.
4. The projection (`src/lib/projection/`) and site-template rendering will need to consume these flags.

**Cross-reference:** OBS-20 (navigation management page); the two items should land together or in sequence.

---

### OBS-22 — Dashboard metrics — richer role-scoped data and charts

**Status:** Active
**Discovered in:** GitHub #4
**File:** `src/lib/activity.ts`, `src/lib/queries/`, `src/components/dashboard/`

#### Description
The dashboard currently shows basic stats (page count, media count, form submissions, recent activity). Operators want richer, role-scoped metrics: edits per block type, edit time-of-day heatmap, most edited pages, and potentially performance metrics. Super-admin and tenant roles must only see data scoped to their context.

#### Why deferred
Requires new query/aggregation logic and agreement on which metrics have the most value before building. Issue explicitly notes suggestions are not conclusive.

#### Suggested fix shape
1. Audit `src/lib/activity.ts` for what's already tracked; extend activity logging if block-type granularity is missing.
2. Add aggregation queries to `src/lib/queries/` (edits-by-block-type, edits-by-hour, top-pages).
3. Add chart components to `src/components/dashboard/` using the existing `@siab/chart` primitive.
4. All queries must accept a `tenantId` param; super-admin passes `null` for global view.
5. Discuss and agree on the metric set before implementing — issue flags this explicitly.

---

### OBS-23 — Settings page — full refactor (design + 2FA + plan + GDPR + logo/favicon)

**Status:** Active
**Discovered in:** GitHub #30
**File:** `src/app/(frontend)/(admin)/settings/`

#### Description
The settings page diverges from the rest of the design language and feels incomplete. The issue requests: design alignment, profile/account management, plan visibility, GDPR data-request flow, 2FA toggle, and additional site settings (maintenance banner, logo/favicon upload).

#### Why deferred
Large scope spanning multiple backend features. Breaking it down: design alignment is FE-only; 2FA requires a Payload auth feature + field lock audit (see doctrine in this file); logo/favicon requires a SiteSettings schema change + projection update; GDPR data request requires a new endpoint.

#### Suggested fix shape
Tackle as sub-items in sequence:
1. **Design alignment** — bring settings tabs/layout in line with other pages (FE-only).
2. **Logo/favicon** — add `logo` (Media relationship) and `favicon` (Media relationship) to `SiteSettings`, migrate, project to `site.json`.
3. **Maintenance banner** — add `maintenanceMode: boolean` + `maintenanceBanner: text` to `SiteSettings`, project to `site.json` so the template can render a banner.
4. **2FA** — research Payload v3 TOTP support before committing to an approach. Apply the "Payload auth-fields default-allow" doctrine immediately on enablement.
5. **GDPR data request** — new endpoint `POST /api/users/request-data` that assembles and emails a data export for the calling user.
6. **Plan** — deferred until a billing/plan system exists.

---

### OBS-24 — More block types + richer WYSIWYG editing (multi-repo)

**Status:** Active
**Discovered in:** GitHub #27
**File:** `src/collections/BlockPresets.ts`, `src/components/editor/BlockTypePicker.tsx`, `src/components/editor/FieldRenderer.tsx` — **also requires changes in `sitegen-template` repo**

#### Description
The current block type set is limited and block type names feel arbitrary to end users (e.g. "RichText"). More block types are needed with better labelling, and the editing experience needs to be more WYSIWYG — especially for text/rich content. Any new block type added here must also be rendered by the site template (`sitegen-template` repo) before it is usable in production.

#### Why deferred
Large cross-repo effort. Requires design work to determine which block types to add, then coordinated changes across this repo (schema + editor) and `sitegen-template` (Preact renderers).

#### Suggested fix shape
1. Agree on the block type set to add (suggested: Pricing, Gallery, Team, Steps, LogoCloud at minimum).
2. Add block schemas to `src/collections/BlockPresets.ts` and `src/collections/Pages.ts` block union.
3. Run migration.
4. Add field renderer UI for each new block type in `src/components/editor/FieldRenderer.tsx`.
5. Add the corresponding Preact renderer in `sitegen-template/src/components/cms/`.
6. Update `Blocks.astro` switch in `sitegen-template` to handle new types.
7. Improve block type names/labels in `BlockTypePicker.tsx` — user-facing names should be plain English (e.g. "Hero Banner" not "hero", "Rich Text" → "Text Block").

**Cross-repo dependency:** `sitegen-template` must ship renderers before new block types are enabled for production tenants.

---

### OBS-25 — Blog posts feature (multi-repo)

**Status:** Active
**Discovered in:** GitHub #7
**File:** New collection required — **also requires changes in `sitegen-template` repo**

#### Description
Higher-tier tenants should have blog post functionality. This requires a new `Posts` collection (or a `post` page type on the existing `Pages` collection), a blog-specific editor experience, and a `sitegen-template` renderer for blog list + detail pages.

#### Why deferred
Large feature; requires product decision on data model (separate collection vs page type) and tier/access gating design before implementation.

#### Suggested fix shape
1. Decide: separate `Posts` collection or a `type: "blog"` variant on `Pages`. Separate collection is cleaner for querying and access control.
2. If separate: add `Posts` collection with `title`, `slug`, `publishedAt`, `author` (relationship to Users), `blocks` (same block union as Pages), `tenant` (multi-tenant scoped).
3. Add `Posts` to `multiTenantPlugin` collections.
4. Add list + detail views in the frontend (`/sites/[slug]/posts/`).
5. Add blog list + post detail renderers in `sitegen-template`.
6. Projection: add `posts/` output to `projectToDisk`.

**Cross-repo dependency:** `sitegen-template` must ship blog renderers before this is usable in production.

---

### OBS-26 — Web analytics page (Plausible/Matomo integration)

**Status:** Active
**Discovered in:** GitHub #31
**File:** `src/collections/SiteSettings.ts`, new route `src/app/(frontend)/(admin)/sites/[slug]/analytics/`

#### Description
Operators want a dashboard view showing visitor analytics for their site, powered by Plausible or Matomo. The tracking ID/domain needs to be stored per tenant in `SiteSettings`, and the site template needs to inject the analytics snippet. A read-only analytics view in the admin should pull data from the provider's API.

#### Why deferred
Requires choosing a provider, provisioning API access, and a SiteSettings schema change + projection update. Non-trivial but self-contained.

#### Suggested fix shape
1. Choose provider (Plausible recommended — simpler API, privacy-friendly, self-hostable).
2. Add `analyticsProvider: select(plausible | matomo | none)` and `analyticsDomain: text` to `SiteSettings`. Migrate + project to `site.json`.
3. Update `sitegen-template` to conditionally inject the provider snippet when `analyticsDomain` is set.
4. Add `/sites/[slug]/analytics` route that calls the provider's stats API (server-side, API key in env) and renders a read-only chart/stats view using `@siab/chart`.
5. Scope: tenant owners/editors see only their own site's analytics.

**Cross-repo dependency:** `sitegen-template` must inject the analytics snippet for data to be collected.

---

## Latent observations — not exploitable today; watch for trigger conditions

### OBS-8 — `_verified` field has `update: defaultAccess` (default-allow)

**Status:** Latent · **HIGH PRIORITY when trigger fires**
**Discovered in:** P1 #7 batch (2026-05 audit cycle)
**T-ID:** T2
**File:** `node_modules/payload/dist/auth/baseFields/verification.js`

#### Description
If `auth.verify: true` is ever enabled on the Users collection, Payload auto-injects a `_verified: boolean` field. Per Payload's source, that field's `access.update` defaults to `defaultAccess` (allow-all-authed). A non-super-admin attacker could PATCH their own user with `{_verified: true}` to bypass email-verification gating.

#### Why deferred
Not currently exploitable — `auth.verify` is `false` (default; not overridden in `Users.ts` config). The `_verified` field is not injected.

#### Trigger condition
**The moment anyone sets `auth.verify: true` on Users, this becomes immediately exploitable.** Same root cause as AMD-2 (apiKey field default-allow) and the P1 #7 email-pivot sibling.

#### Suggested fix shape (when triggered)
Same pattern as AMD-2: declare an explicit `_verified` field in `Users.fields` with `access: { create: isSuperAdminField, update: isSuperAdminField }` to override Payload's auto-injection default. Verify the override mechanism via Payload source (same investigation as AMD-2). Plus extend `rejectNonSuperAdminCredentialWrites` (P1 #7) hook to also reject `_verified` writes from non-super-admin.

#### Meta-observation
This is the third instance of the "Payload auth-fields default-allow" vulnerability class (AMD-2 apiKey, P1 #7 email-pivot, OBS-8 `_verified`). If Users config grows further auth features (e.g. `auth.loginWithUsername: true` injects `username` with default-allow), expect a fourth instance. **Meta-rule for permanent codebase doctrine:** *whenever enabling a Payload auth feature, audit the auto-injected fields' access defaults the same day.*

---

### OBS-9 — `Users.access.create` admits owner unconditionally (defense-in-depth single-point-of-failure)

**Status:** Latent (defense-in-depth concern)
**Discovered in:** AMD-1 batch (2026-05 audit cycle)
**T-ID:** T1 / T2
**File:** `src/collections/Users.ts:157-163` (`Users.access.create`)

#### Description
`Users.access.create` returns `true` for any caller with `req.user?.role === "owner"` (or super-admin). The cross-tenant scoping on POST `/api/users` relies entirely on the field-level `canCreateUserField` gate stripping `tenants` for owner-creates targeting other tenants, then `validateTenants` rejecting the resulting empty-tenants payload. Single chain of defense.

#### Why deferred
Not exploitable today — the chain holds. The concern is defense-in-depth: if `validateTenants` is ever weakened (e.g. accepting empty tenants for non-super-admin), or if `canCreateUserField` is changed (e.g. AMD-1 fix relaxed), the cross-tenant guard collapses silently.

#### Trigger condition
If any future change touches `validateTenants` or `canCreateUserField` semantics. Detect via test coverage that pins both invariants.

#### Suggested fix shape
Add a collection-level `Users.access.create` check that explicitly rejects cross-tenant creates by non-super-admin (e.g. `if owner caller AND data.tenants[0].tenant !== caller.tenants[0].tenant → return false`). Currently the access function admits and the field gate handles tenant scoping; making the access function tenant-aware too would be belt-and-braces.

---

### OBS-10 — `String(target) === String(own)` false-negative on populated-object form

**Status:** Latent (functional regression, not security)
**Discovered in:** AMD-1 batch (2026-05 audit cycle)
**T-ID:** None (functional brittleness)
**File:** `src/collections/Users.ts` `canCreateUserField` (Branch C5)

#### Description
The owner-invite tenant-scoping check uses `String(target) === String(own)`. If Payload's data-loader ever returns `data.tenants[0].tenant` as a populated object `{id: 42}` instead of a bare scalar `42` on a create write, the comparison reduces to `"[object Object]" === "42"` → false → field stripped → legit owner invite rejected.

#### Why deferred
Production call site (`inviteUser.ts:50`) supplies a bare scalar (`tenant: input.tenantId`) so unaffected today. Not a security issue (false-negative, not false-positive).

#### Trigger condition
If Payload's auth depth or data-loader behavior changes such that `data.tenants[0].tenant` arrives populated on a write path. Or if the orchestrator (or any other internal code) starts passing populated form to `payload.create`.

#### Suggested fix shape
Normalize the comparison: extract `.id` if the value is an object, then compare. Same helper as `extractTenantId` already used elsewhere in `Users.ts`.

---

## Audit-deferred — explicitly punted by audit text, tied to future feature

### OBS-11 — hCaptcha / Turnstile on public form

**Status:** Audit-deferred
**Discovered in:** 2026-05 audit cycle (audit-text scope decision)
**T-ID:** T4
**File:** TBD (no public form exists today)

#### Description
Audit finding #5's third suggested sub-fix (hCaptcha or Turnstile on the public form widget) was explicitly deferred per the audit text: *"once the v1 contact form lands."*

#### Why deferred
No public-facing form widget exists in this codebase yet. The Forms collection accepts submissions via API but there's no client-side widget for unauthenticated visitors to submit through.

#### Trigger condition
A v1 contact form goes live on tenant sites (most likely in the separate site-template repo, but consuming this CMS's `/api/forms` endpoint).

#### Suggested fix shape
Add hCaptcha or Cloudflare Turnstile token to the form submission. Server-side validate the token before accepting the row. Combined with P1 #5's existing rate-limit + 32 KB cap, this closes T4 for public form submissions.

---

### OBS-12 — DB-backed manifest (architectural alternative to filesystem-level race fix)

**Status:** Audit-deferred (potential future architectural change)
**Discovered in:** P2 #12 batch (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/lib/projection/manifest.ts`

#### Description
The current P2 #12 fix uses atomic rename + in-process mutex (single-instance correctness). If the deployment ever scales horizontally (multi-replica), filesystem-level races re-emerge between replicas. Moving manifest state to a `manifests` collection in DB would eliminate this entirely.

#### Why deferred
Out-of-scope for the P2 batch (architectural change). The current fix covers single-instance correctness, which is the deployment shape today.

#### Trigger condition
Deployment moves to multi-replica / horizontal scaling.

#### Suggested fix shape
Create a `manifests` collection scoped per-tenant. Each row keys on `tenant + manifest_path`. `projectToDisk` reads/writes via Payload `find` / `upsert` instead of filesystem ops. Filesystem still holds the projected page JSON; only the manifest moves to DB.

---

### OBS-16 — In-process mutex doesn't protect multi-replica deployments

**Status:** Latent (architectural — depends on deployment shape)
**Discovered in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/lib/projection/manifest.ts:48-58` (the mutex's docstring already notes this)

#### Description
P2 #12's fix uses an in-process `Mutex` keyed on the manifest path. This serializes concurrent writes within the SAME Node process. If the deployment ever runs multiple replicas (k8s `replicas > 1`, Docker Swarm scaling, etc.), each replica has its own mutex instance — concurrent writes across replicas are no longer serialized, and the lost-update race re-emerges.

#### Why deferred
Current deployment is single-instance per `docker-compose.yml` (no `replicas` field, single container). The mutex is sufficient for the deployment shape that exists today. The mutex's source comment at `src/lib/projection/manifest.ts:48-58` explicitly documents this limitation so a future deploy-shape change is forced to reckon with it.

#### Trigger condition
Deployment moves to multi-replica (k8s `replicas > 1`, Docker Swarm `replicas > 1`, ECS service `desiredCount > 1`, etc.).

#### Suggested fix shape (when triggered)
Three viable options:
1. **Advisory Postgres lock** keyed on `tenantId` (`pg_advisory_xact_lock`) — serializes manifest writes across all replicas via the shared DB. Cheap; shared-DB dependency required (which this codebase already has).
2. **DB-backed manifest** per OBS-12 — eliminates filesystem race entirely; replaces the per-write file-mutex with DB-level consistency.
3. **File-based lock** (`flock` or `proper-lockfile`) — POSIX-portable; works as long as all replicas mount the same NFS/EBS volume. Adds I/O but minimal change to current code shape.

Option 1 is the smallest delta if the bind-mounted data volume continues to be the source of truth. Option 2 is the cleanest long-term. Option 3 is most fragile.

OBS-12 and OBS-16 are linked: OBS-16 is the "what fails when scaling" observation; OBS-12 is the "DB-backed alternative" implementation note. Closing one closes the other.

---

## Closed — handled, kept for lineage

### OBS-3 (graphql-playground iframable) — Closed
→ Closed by `fix/audit-p3-batch-1-cleanup` (P3 #16 env-gate). The playground returns 404 in production unless `ENABLE_GRAPHQL_PLAYGROUND=1` is explicitly set; the iframable HTML surface no longer exists in default-production deployments.

### OBS-CLOSED (AMD chain from 2026-05 audit cycle)

These items were promoted from observations directly into amendment batches during the cycle:

- **AMD-1 — Owner cannot invite team members** (originally observed in P1 batch-1 review). → Closed by `fix/audit-amendment-1-owner-invite`, merged in `e8985b4`.
- **AMD-2 — `apiKey` mass-assignment on Users** (originally observed in AMD-1 review). → Closed by `fix/audit-amendment-2-apikey-access`, merged in `f857ff7`.
- **AMD-3 — `ApiKeyManager` UI silent failure** (originally observed in AMD-2 review). → Closed by `fix/audit-amendment-3-apikey-honest-rejection`, merged in `4acac39`.

---

## Out of scope — permanent decisions per 2026-05 threat model

NOT tracked individually here. Permanent decisions:

- Distributed flood from many real IPs / botnet (network/CDN/WAF concern)
- XFF spoofing for rate-limit bucket evasion (network concern)
- Memory-exhaustion attack on rate-limit store (network concern)
- OS-level malware / browser extensions with `<all_urls>` permissions (client concern, no app-layer defense)
- Side-channel timing attacks (CPU cache, page-fault, etc.) — except token-comparison timing in HMAC verification (T6)
- Compliance frameworks not signed up for: SOC2, ISO 27001, HIPAA, PCI-DSS
- Race conditions across multi-process/multi-replica deploys (out-of-scope unless horizontally scaled — see OBS-12 / OBS-16)

If any become in-scope (e.g. SOC2 onboarding, horizontal scaling), open a meta-amendment to bring them into scope and re-audit.

---

## Doctrine surfaced by the 2026-05 audit cycle

Worth promoting to permanent codebase rules. Add to your CONTRIBUTING.md / PR-review checklist:

1. **Payload "auth-fields default-allow" rule.** Whenever enabling a Payload auth feature (`useAPIKey`, `verify`, `loginWithUsername`, etc.), audit the auto-injected fields' access defaults the same day. **Every Payload auth feature you enable adds new auto-injected fields with default-allow access. Each one needs explicit access locking.** Track instances: AMD-2 (apiKey), P1 #7 email-pivot (email), OBS-8 (`_verified`), OBS-13 (i18n).
2. **Migration safety doctrine.** Hand-write migrations (don't trust `pnpm payload migrate:create` autogen). `down()` MUST throw, never reverse. `up()` MUST refuse on incompatible state (no silent data mutation). Pre-flight on production with the duplicate-detection query before applying.
3. **No "soft notes" in security review.** Real → Fails. Hand-wavy → drop. There is no middle ground that ships.

---

## Item shape (when adding new entries)

```markdown
### OBS-N — <short title>

**Status:** Active | Latent | Audit-deferred | Closed
**Discovered in:** <where: cycle / PR / incident / etc.>
**T-ID:** <if applicable>
**File:** `path:line` (if applicable)

#### Description
<what the issue is>

#### Why deferred
<one-line reason>

#### Trigger condition
<what would warrant promoting this to a fix batch>

#### Suggested fix shape
<the shape of the fix when it's eventually addressed>
```

Future `OBS-N` entries continue the numbering — current high water mark is OBS-26. Don't reuse closed IDs.

# Security Backlog

Canonical source of truth for security findings, vulnerability observations, and access-control gaps surfaced during audits, PR reviews, or adversarial review passes.

## How this file is used

- IDs use the `OBS-N` scheme inherited from the 2026-05 audit cycle. New security items continue the same sequence (current high water mark: OBS-26 across all backlog files — next security item is OBS-27).
- **Status tiers:** Active (real, deferred), Latent (not exploitable today — trigger documented), Audit-deferred (explicitly punted per audit text), Closed (resolved).
- **When a trigger condition fires**, promote the item immediately to a fix batch. Do not defer further.
- **When a PR touches a Payload auth feature** (`useAPIKey`, `verify`, `loginWithUsername`, etc.), check the Doctrine section below and audit auto-injected fields the same day.

Cross-reference: product features at `../features/README.md`, infra items at `../infra/README.md`.

The full audit cycle's working artifacts (threat model, batch reports, adversarial-review verdicts) live at `~/Desktop/env/siab-payload-fixer/audits/`. Per-batch reports reference these `OBS-N` IDs — do not renumber.

---

## Active

### OBS-1 — `script-src 'unsafe-inline' 'unsafe-eval'` in admin CSP

**Status:** Active (acceptable today)
**Discovered in:** P1 batch-1 (2026-05 audit cycle)
**T-ID:** T9 / T12
**File:** `src/middleware.ts` — `ADMIN_CSP` / `PREVIEW_CSP` constants

#### Description
The admin CSP ships with `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. The deviation is required because Next.js App Router emits inline hydration scripts and runtime-eval chunks. The audit's strawman CSP suggested `script-src 'self'` only.

#### Why deferred
T9 (stored XSS) is currently Medium-Low because RichText is a plain textarea with no rich-HTML rendering surface. `'unsafe-inline' 'unsafe-eval'` has nothing to amplify today.

#### Trigger condition
When Tiptap / Lexical / any rich-HTML editor lands and stores HTML in the DB. T9 escalates from Low to High immediately.

#### Suggested fix shape
1. Generate a per-request nonce in middleware.
2. Inject nonce into Next's script tags via header/page-level mechanism.
3. Remove `'unsafe-inline' 'unsafe-eval'` from `script-src`; add `'nonce-${nonce}'`.
4. Verify hydration still works — Next.js 15 has documented patterns for this.

See also OBS-18 which tracks the nonce work independently of the trigger condition.

---

### OBS-2 — `/__preview*` reserved CSP branch is dormant but path-active

**Status:** Active (latent surface)
**Discovered in:** P1 batch-1 (2026-05 audit cycle)
**T-ID:** T12
**File:** `src/middleware.ts` — `isPreviewPath`, `PREVIEW_CSP`

#### Description
Middleware has a reserved `/__preview*` path branch applying a more permissive CSP (no `frame-ancestors`, no `X-Frame-Options`). Today no routes exist under `/__preview/*` so Next.js renders 404. If a future PR mounts sensitive content there, it would be served clickjackable.

#### Trigger condition
A PR adds a route under `/__preview/*` that renders authenticated content. PR review must catch this.

#### Suggested fix shape
Either: (a) a runtime sanity check that no `/__preview/*` route exists in production; or (b) an architectural rule that any `/__preview/*` route must be explicitly designed for the preview-iframe context with CSP review.

---

### OBS-4 — DB-cost amplification on bogus `Authorization: users API-Key <random>`

**Status:** Active (low realistic priority)
**Discovered in:** P1 #5 batch (2026-05 audit cycle)
**T-ID:** T4
**File:** `node_modules/payload/dist/auth/strategies/apiKey.js:8-21`

#### Description
Anonymous attacker sends `Authorization: users API-Key <random>` repeatedly. P1 #5's middleware bypasses on auth-signal presence; apiKey strategy runs (2 HMACs + 1 indexed DB query per request); strategy returns `{user: null}`; gate rejects. At sustained 10k req/sec: 20k HMAC computations + 10k DB queries/sec with no write path.

#### Trigger condition
Production CPU spikes correlated with bogus API-Key headers, or legitimate apiKey lookup load becomes non-trivial as tenant count grows.

#### Suggested fix shape
Cheap pre-check before HMAC: length-bound the credential (`if (apiKey.length < 16 || apiKey.length > 256) return {user: null}`) to reject obviously-malformed credentials before the expensive HMAC + DB query. Requires wrapping upstream strategy or contributing upstream.

---

### OBS-5 — Authed-tenant-abuse residual on `/api/users/forgot-password`

**Status:** Active (by design, low realistic priority)
**Discovered in:** P1 #5 batch (2026-05 audit cycle)
**T-ID:** T4
**File:** `src/middleware.ts` rate-limit logic + `src/access/authSignals.ts`

#### Description
P1 #5's rate-limit is anonymous-only (no `payload-token` + no `Authorization`). An authed editor can flood `/api/users/forgot-password` with arbitrary victim emails to spam them with reset-password emails, bypassing the rate-limit.

#### Why deferred
Closing the authed-tenant-abuse gap requires JWT decoding in middleware to distinguish orchestrator from abuser — not trivial, and the audit didn't surface this gap explicitly.

#### Trigger condition
Observed in practice, or an audit pass raises it.

#### Suggested fix shape
Per-user rate-limit on forgot-password (rate-limit by `req.user.id`, not IP), applied after Payload auth has run. Or per-target-email rate-limit (N resets per email per hour).

---

### OBS-6 — Owner-invite to typo'd email creates account at wrong address

**Status:** Active (UX + minor confidentiality concern)
**Discovered in:** P1 #7 batch (2026-05 audit cycle)
**T-ID:** None
**File:** `src/lib/actions/inviteUser.ts`

#### Description
An owner who typos an invitee email creates an account at the wrong address. The unintended recipient receives the reset link and could complete signup as an editor/viewer in the inviter's tenant.

#### Why deferred
Not a takeover of an existing account. UX/confidentiality concern outside P1 #7's scope.

#### Suggested fix shape
Either: (a) `auth.verify: true` on Users requiring email confirmation (see OBS-8 for the field-access prerequisite); (b) prominent email confirmation in invite-success UI; or (c) invite-revocation flow within N hours.

---

### OBS-7 — List pages cap silently at 50 without pagination UI

**Status:** Active (UX regression from P2 #13 fix)
**Discovered in:** P2 batch-1 (2026-05 audit cycle)
**T-ID:** None (UX paper-cut)
**File:** `src/lib/queries/{pages,media,forms}.ts` consumers in admin UI pages

#### Description
P2 #13 replaced the unsafe `limit: 500` with `pageSize: 50` paginated variants. The admin list pages still call the legacy non-paginated wrappers, now defaulting to 50. Tenants with >50 docs see only the first 50 with no UI to navigate further.

#### Trigger condition
Tenant with >50 pages/media/forms reports inability to see all content.

#### Suggested fix shape
Add page/pageSize URL params to admin list pages. Wire the `@siab/` Pagination component. Total pages comes from `*Paginated` variants which already return `totalDocs`/`totalPages`. ~30 lines per list page. Cross-reference features backlog when wired — the UX surface lives in admin pages.

---

### OBS-13 — i18n fallback-language trapdoor on `getOrCreateSiteSettings` race detection

**Status:** Active (forward-compat trapdoor)
**Discovered in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/lib/queries/settings.ts` `isUniqueViolation` channel 1

#### Description
`isUniqueViolation` channel 1 matches against `req.t('error:valueMustBeUnique')`. Today `payload.config.ts` has no `i18n` block so `t` defaults to English and the comparison `=== "Value must be unique"` works. If a PR adds `i18n: { fallbackLanguage: 'nl' }`, `req.t` returns the Dutch translation and channel 1 silently degrades. Channels 2 and 3 also don't fire. Race-loser re-surfaces a 400 — same vector as finding #11.

#### Trigger condition
Anyone enables i18n in `payload.config.ts` with a non-English fallback. Add this to the i18n-enabling PR's review checklist.

#### Suggested fix shape
In `isUniqueViolation` channel 1, also accept any first-error whose `path === "tenant"` — the path field is language-invariant:
```ts
if (err instanceof ValidationError && err.data?.errors?.[0]?.path === "tenant") return true
```

---

### OBS-14 — `tenantLifecycle.createTenantDir` writes empty manifest unsynchronized

**Status:** Active (theoretical race, practically infeasible today)
**Discovered in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/hooks/tenantLifecycle.ts:19`

#### Description
`createTenantDir` runs in `Tenants.afterChange[create]` and writes an empty initial manifest without going through the per-tenant mutex added by P2 #12. A theoretical race with a tenant's first content publish could clobber the first projection entry.

#### Why deferred
Practically infeasible: `createTenantDir` completes in milliseconds; the user must then navigate, log in, create content, and publish before the race window closes. Seconds-to-minutes vs milliseconds.

#### Trigger condition
Tenant creation becomes asynchronous (e.g. job-queue-based provisioning).

#### Suggested fix shape
Wrap the `createTenantDir` write with the same `withManifestMutex` helper P2 #12 added. One-line change.

---

### OBS-15 — `writeAtomic` leaks `.tmp.<pid>.<ts>` files on write failure

**Status:** Active (operational hygiene)
**Discovered in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** None
**File:** `src/lib/atomicWrite.ts`

#### Description
`writeAtomic` writes to a temp file then `fs.rename`s atomically. If `writeFile` or `fsync` fails, the `finally` closes the handle but does not `unlink` the temp file. Failed writes accumulate `.tmp.*` debris in manifest directories.

#### Suggested fix shape
Add `await unlink(tmpPath).catch(() => {})` to the error path of `writeAtomic`'s try/catch. The `.catch(() => {})` is intentional — if unlink itself fails we don't want to mask the original write error.

---

### OBS-17 — `media.filename` cross-tenant rename leak (Payload upstream `getSafeFileName` runs before hook)

**Status:** Active (residual on partially-closed P3 #15) · **Largest open architectural item**
**Discovered in:** P3 batch (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/collections/Media.ts` · `src/hooks/projectToDisk.ts:71-110` · `node_modules/payload/dist/uploads/getSafeFilename.js:46-58`

#### Description
P3 #15's two-layer fix (compound `(tenant_id, filename)` UNIQUE INDEX + `ensureUniqueTenantFilename` beforeValidate hook) closes the schema half but not the upload pipeline. Payload calls `getSafeFileName` BEFORE `beforeValidate` hooks. `getSafeFileName` queries `docWithFilenameExists` with no tenant filter, so when Tenant B uploads `logo.png` while Tenant A has it, Payload renames to `logo-1.png` — leaking that Tenant A has `logo.png`.

#### Why deferred
Proper closure requires per-tenant `staticDir` rework, which exceeded P3 scope. Severity remains Low (filename existence leak, not file content). Three candidate alternatives were evaluated and rejected (see original backend backlog for full analysis).

#### Trigger condition
(a) Deployment needs legitimate same-filename uploads across tenants; (b) a future audit re-flags with elevated severity; (c) operator complaints about unexpected renames.

#### Suggested fix shape
Implement per-tenant on-disk paths: replace `_uploads-tmp/<filename>` with `_uploads-tmp/<tenantId>/<filename>`. Requires a custom Next.js route handler for `/api/media/file/<filename>` that resolves tenant from host, migration of existing files, and update to `projectMediaToDisk`. Set `overwriteExistingFiles: true` once the per-tenant partition is in place.

---

### OBS-18 — CSP `unsafe-inline` / `unsafe-eval` not tightened to nonces

**Status:** Active
**Discovered in:** audit-p1 batch 4 (documented deviation); confirmed open 2026-05-11
**File:** `src/middleware.ts` — `ADMIN_CSP` and `PREVIEW_CSP` constants

#### Description
Both CSP strings use `'unsafe-inline'` on `script-src` and `style-src`, and `'unsafe-eval'` on `script-src`. The audit's strawman CSP called for nonces; the shipped version uses blanket unsafe flags as a documented deviation. `applySecurityHeaders` is a single call-site so nonce plumbing lands in one place when attempted.

#### Why deferred
Nonce injection in Next.js App Router requires per-request nonce generation in middleware, header propagation, and consumption in every `<script>` tag in the RSC tree. Non-trivial; accepted as deferred hardening.

#### Suggested fix shape
1. Generate a per-request nonce in `middleware.ts`.
2. Replace `'unsafe-inline'` with `'nonce-${nonce}'` in `script-src`.
3. Pass nonce to app via response header (e.g. `x-csp-nonce`).
4. Read in root layout and inject `<script nonce={nonce}>` on all inline scripts.
5. `style-src 'unsafe-inline'` is harder — Tailwind v4 runtime CSS requires it unless build-time-only.

---

## Latent — not exploitable today; watch for trigger conditions

### OBS-8 — `_verified` field has `update: defaultAccess` (default-allow)

**Status:** Latent · **HIGH PRIORITY when trigger fires**
**Discovered in:** P1 #7 batch (2026-05 audit cycle)
**T-ID:** T2
**File:** `node_modules/payload/dist/auth/baseFields/verification.js`

#### Description
If `auth.verify: true` is ever enabled on Users, Payload auto-injects a `_verified: boolean` field with `access.update: defaultAccess` (allow-all-authed). A non-super-admin attacker could PATCH `{_verified: true}` to bypass email-verification gating.

#### Trigger condition
**The moment anyone sets `auth.verify: true` on Users, this becomes immediately exploitable.**

#### Suggested fix shape
Declare `_verified` explicitly in `Users.fields` with `access: { create: isSuperAdminField, update: isSuperAdminField }`. Also extend `rejectNonSuperAdminCredentialWrites` to reject `_verified` writes from non-super-admin.

---

### OBS-9 — `Users.access.create` admits owner unconditionally (single-point defense-in-depth)

**Status:** Latent (defense-in-depth concern)
**Discovered in:** AMD-1 batch (2026-05 audit cycle)
**T-ID:** T1 / T2
**File:** `src/collections/Users.ts:157-163`

#### Description
`Users.access.create` returns `true` for any owner caller. Cross-tenant scoping on POST `/api/users` relies entirely on `canCreateUserField` stripping `tenants` for wrong-tenant creates, then `validateTenants` rejecting the empty result. Single chain; if either is weakened, cross-tenant guard collapses silently.

#### Trigger condition
Any future change touching `validateTenants` or `canCreateUserField` semantics.

#### Suggested fix shape
Add an explicit tenant-scoping check in `Users.access.create` for owner callers: reject if `data.tenants[0].tenant !== caller.tenants[0].tenant`. Belt-and-braces alongside the existing field-gate chain.

---

### OBS-10 — `String(target) === String(own)` false-negative on populated-object form

**Status:** Latent (functional brittleness)
**Discovered in:** AMD-1 batch (2026-05 audit cycle)
**T-ID:** None
**File:** `src/collections/Users.ts` `canCreateUserField` Branch C

#### Description
Owner-invite tenant-scoping uses `String(target) === String(own)`. If Payload's data-loader ever returns `data.tenants[0].tenant` as a populated object `{id: 42}` instead of a bare scalar, the comparison becomes `"[object Object]" === "42"` → false → legit invite rejected.

#### Trigger condition
Payload auth depth or data-loader behavior changes such that `data.tenants[0].tenant` arrives populated on a write path.

#### Suggested fix shape
Normalize: extract `.id` if value is an object, then compare. Same helper as `extractTenantId` used elsewhere in `Users.ts`.

---

## Audit-deferred — explicitly punted by audit text, tied to future feature

### OBS-11 — hCaptcha / Turnstile on public form

**Status:** Audit-deferred
**Discovered in:** 2026-05 audit cycle
**T-ID:** T4

#### Description
Audit finding #5's third sub-fix (bot protection on the public form widget) was explicitly deferred: *"once the v1 contact form lands."* No public-facing form widget exists in this repo yet — the Forms collection accepts API submissions but there's no client widget.

#### Trigger condition
A v1 contact form widget goes live on tenant sites (likely in `sitegen-template`, consuming `/api/forms`).

#### Suggested fix shape
Add hCaptcha or Cloudflare Turnstile token validation to the form submission endpoint. Server-side validate token before accepting the row. Combined with P1 #5's existing rate-limit + 32 KB cap, closes T4 for public form submissions.

---

### OBS-12 — DB-backed manifest (architectural alternative to filesystem race fix)

**Status:** Audit-deferred (potential future architectural change)
**Discovered in:** P2 #12 batch (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/lib/projection/manifest.ts`

#### Description
P2 #12's fix uses atomic rename + in-process mutex (correct for single-instance). If deployment ever scales horizontally, filesystem races re-emerge between replicas. Moving manifest state to a `manifests` DB collection would eliminate this entirely.

#### Trigger condition
Deployment moves to multi-replica / horizontal scaling.

#### Suggested fix shape
Create a `manifests` collection scoped per-tenant. `projectToDisk` reads/writes via Payload Local API instead of filesystem ops. Filesystem still holds projected JSON; only the manifest moves to DB.

**Cross-reference:** OBS-16 (same trigger condition — close one, close both).

---

### OBS-16 — In-process mutex doesn't protect multi-replica deployments

**Status:** Latent (architectural — depends on deployment shape)
**Discovered in:** P2 batch-2 (2026-05 audit cycle)
**T-ID:** T8
**File:** `src/lib/projection/manifest.ts:48-58`

#### Description
P2 #12's `Mutex` serializes concurrent writes within the same Node process. Multiple replicas each have their own mutex — concurrent cross-replica writes are not serialized and the lost-update race re-emerges.

#### Trigger condition
Deployment moves to multi-replica (k8s `replicas > 1`, Docker Swarm, ECS `desiredCount > 1`, etc.).

#### Suggested fix shape
Three options: (1) Postgres advisory lock keyed on `tenantId` — smallest delta; (2) DB-backed manifest per OBS-12 — cleanest long-term; (3) `flock` / `proper-lockfile` — works if all replicas share a volume.

**Cross-reference:** OBS-12 (closing one closes both).

---

## Closed — handled, kept for lineage

### OBS-3 — GraphQL playground iframable
Closed by `fix/audit-p3-batch-1-cleanup` (P3 #16 env-gate). Playground returns 404 in production unless `ENABLE_GRAPHQL_PLAYGROUND=1` is set; iframable surface no longer exists in default deployments.

### AMD chain (2026-05 audit cycle)
- **AMD-1 — Owner cannot invite team members** → Closed by `fix/audit-amendment-1-owner-invite` (`e8985b4`)
- **AMD-2 — `apiKey` mass-assignment on Users** → Closed by `fix/audit-amendment-2-apikey-access` (`f857ff7`)
- **AMD-3 — `ApiKeyManager` UI silent failure** → Closed by `fix/audit-amendment-3-apikey-honest-rejection` (`4acac39`)

---

## Out of scope — permanent decisions per 2026-05 threat model

- Distributed flood from many real IPs / botnet (network/CDN/WAF concern)
- XFF spoofing for rate-limit bucket evasion (network concern)
- Memory-exhaustion on rate-limit store (network concern)
- OS-level malware / browser extensions with `<all_urls>` (client concern)
- Side-channel timing attacks (except token-comparison timing in HMAC verification — T6)
- Compliance frameworks not signed up for: SOC2, ISO 27001, HIPAA, PCI-DSS
- Race conditions across multi-process/multi-replica deploys (out-of-scope unless horizontally scaled — see OBS-12/OBS-16)

If any become in-scope, open a meta-amendment and re-audit.

---

## Doctrine

Permanent codebase rules surfaced by the 2026-05 audit cycle:

1. **Payload "auth-fields default-allow" rule.** Whenever enabling a Payload auth feature (`useAPIKey`, `verify`, `loginWithUsername`, etc.), audit the auto-injected fields' access defaults the same day. Every Payload auth feature adds new auto-injected fields with default-allow access. Each one needs explicit access locking. Known instances: AMD-2 (apiKey), P1 #7 (email), OBS-8 (`_verified`), OBS-13 (i18n).
2. **Migration safety doctrine.** Hand-write migrations. `down()` MUST throw, never reverse. `up()` MUST refuse on incompatible state. Pre-flight on production with the duplicate-detection query before applying.
3. **No "soft notes" in security review.** Real → Fails. Hand-wavy → drop. No middle ground ships.

---

## Item shape (when adding new entries)

```markdown
### OBS-N — <short title>

**Status:** Active | Latent | Audit-deferred | Closed
**Discovered in:** <cycle / PR / incident / etc.>
**T-ID:** <if applicable>
**File:** `path:line` (if applicable)

#### Description

#### Why deferred

#### Trigger condition

#### Suggested fix shape
```

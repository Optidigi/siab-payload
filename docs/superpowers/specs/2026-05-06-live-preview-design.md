# Live Preview — Design Spec

**Date:** 2026-05-06
**Status:** Approved (post 2-researcher + 2-reviewer stress-test consensus + operator gate). Ready for implementation plan.
**Wave:** 3 (final wave on the Phase-1 admin roadmap)
**Repos touched:** `siab-payload` (CMS) + `sitegen-template` (Astro template) + `sitegen-cms-orchestrator` (env wiring only)

## Goal

Operator types in the page editor → sees the page rendered with the real tenant theme update in the preview pane in <100ms, without iframe reloads or visible flicker. The deployed Astro tenant site IS the preview renderer (pixel-perfect by construction), but the live experience is driven by client-side Preact reconciliation over postMessage transport.

## Non-goals (explicit deferrals)

- **Stakeholder review URLs.** Preview is admin-only behind a short-lived signed URL. Sharing draft URLs with non-CMS users is a future wave.
- **Multi-author collaboration.** Two operators editing the same Page see their own previews; existing per-save PATCH semantics handle conflicts. No live cursor / OT.
- **Preview of saved-but-unpublished revisions.** This is a draft preview only. Versioning is its own future wave.
- **Block design polish.** Renderers ship with sensible Tailwind defaults. Per-tenant theme overrides come via CSS custom properties in a future wave.
- **Themes.** `sitegen-themes/` is empty today; this wave doesn't change that.

## Why this design

Working backward from two operator priorities:

1. **Pixel-perfect WYSIWYG-ish authoring.** Drove the "deployed Astro site IS the preview" architecture — no second renderer to maintain. The render seen in the preview pane is the actual production component tree.
2. **Smoothness without parity tax.** Drove Preact `.tsx` (server-rendered on tenant pages = 0 KB JS, hydratable on the `__preview` route) over `.astro`. One source of truth, both modes.

A pre-existing finding shaped scope: the orchestrator's `site-converter` agent currently scaffolds `Blocks.astro` that only renders `richText`. **All other 6 block types are silently dropped on deployed tenant sites.** Wave 3 closes this gap as part of building the renderers Live Preview needs anyway (Path X).

## Architecture

```
┌─────────────────────────────────────┐    ┌──────────────────────────────────┐
│ siab-payload (CMS, this repo)       │    │ sitegen-template (Astro template)│
│ admin.siteinabox.nl                 │    │ pulled per tenant by orchestrator│
│                                     │    │ → optidigi/site-<slug>           │
│  PageForm.tsx                       │    │                                  │
│   ├── BlockEditor.tsx               │    │  src/components/cms/Blocks.astro │
│   └── PreviewPane.tsx ◄─NEW         │    │   ├── Hero.tsx ◄─NEW (Preact)    │
│        │                            │    │   ├── FeatureList.tsx ◄─NEW      │
│        │ (cross-origin postMessage) │    │   ├── Testimonials.tsx ◄─NEW     │
│        ▼                            │    │   ├── FAQ.tsx ◄─NEW              │
└────────│────────────────────────────┘    │   ├── CTA.tsx ◄─NEW              │
         │                                 │   ├── RichText.tsx ◄─REFACTOR    │
         │                                 │   └── ContactSection.tsx ◄─NEW   │
         │                                 │  src/pages/__preview.astro ◄─NEW │
         │                                 │   (signed URL gate +             │
         │                                 │    Preact island that            │
         └────────────────────────────────►│    listens for postMessage)      │
                                           └──────────────────────────────────┘
```

### Three transports
1. **Disk → Astro server** (existing, unchanged): tenant page renders read JSON from mounted Payload data dir.
2. **HMAC-signed iframe URL** (new): admin mints a token, embeds it as `?t=<jwt>` on the iframe URL. Tenant `__preview` route gates on it.
3. **postMessage** (new): keystroke-rate updates after iframe is open.

### Data flow — normal page render (today + after Wave 3)
Payload `afterChange` hook writes JSON to `tenants/<id>/pages/<slug>.json` → tenant Astro server reads on each request → `Blocks.astro` switches on `blockType` → renders matching `.tsx` server-only → 0 KB JS in the response.

### Data flow — live preview (new)
Operator opens Page in admin → PageForm mounts `<PreviewPane>` → admin calls `POST /api/preview-tokens` → CMS returns signed token (10 min TTL → updated to **30 min** per Q-3 decision) → iframe `src=https://<tenant>/__preview?t=<token>` (one-time load, ~300-500ms) → `__preview.astro` validates HMAC server-side → renders Preact island shell hydrated with `client:load` → island sends `preview:ready` postMessage to admin → admin's `useEffect` debounces `form.watch()` changes and posts `preview:draft` messages → island swaps props → React reconciles → sub-50ms repaint.

## Block renderers

### Conventions

All renderers live at `sitegen-template/src/components/cms/<Name>.tsx`. Pure functions: `(props) => JSX`. No data fetching, no side effects. Props match the Payload Block field config exactly (see `siab-payload/src/blocks/<Name>.ts` for shapes).

Tailwind utility classes for layout/typography. Theme tokens via CSS custom properties (`var(--color-primary)` etc.) for future themability without component changes. Empty/missing optional fields render gracefully — no broken layouts on partial drafts (load-bearing for live-preview UX where fields fill in mid-edit).

Image refs (Payload Media id) resolved to URLs by `Blocks.astro` before the component renders, via a `mediaResolver` prop:
- Normal render: `(id) => "/media/${id}/file.jpg"` (tenant disk path)
- Preview render: `(id) => "${PUBLIC_CMS_ORIGIN}/api/media/${id}/file"` (CMS origin) — necessary because the operator may have just picked an image not yet written to tenant disk.

### Renderers built in this wave

Field names below are verified against `siab-payload/src/blocks/*.ts` at HEAD `cab090d`. `*` = required.

| Component | Source props (CMS Block) | Notes |
|---|---|---|
| `Hero.tsx` | `eyebrow`, `headline*`, `subheadline`, `cta { label, href }`, `image` | `cta` is a group; `image` resolved by mediaResolver |
| `FeatureList.tsx` | `title`, `intro`, `features*[] { title*, description, icon }` | `icon` is a lucide-react icon-name string (renderer must allowlist or dynamic-import to avoid balloon — flagged in 3b reviewer scope, not blocking) |
| `Testimonials.tsx` | `title`, `items*[] { quote*, author*, role, avatar }` | `avatar` resolved by mediaResolver |
| `FAQ.tsx` | `title`, `items*[] { question*, answer* }` | |
| `CTA.tsx` | `headline*`, `description`, `primary { label*, href* }`, `secondary { label, href }` | `primary`/`secondary` are groups; primary's label+href both required |
| `RichText.tsx` | `body*` | `body` is `textarea` (plain-text source). Existing `RichText.astro` renders via `set:html` — operator-trusted content, XSS posture documented in Risks. v2 plans a Tiptap-backed editor per the field's admin comment; renderer swap-only at that point. **No `heading` field** (the existing `.astro` accepted one but the CMS Block doesn't define it — pre-existing scaffold drift; this wave drops it). |
| `ContactSection.tsx` | `title`, `description`, `formName*`, `fields*[] { name*, label*, type*, required }` | `formName` defaults `"Contact form"`; `type` enum: `text` / `email` / `tel` / `textarea` |

Each component wrapped at usage site by a `<BlockErrorBoundary>` so a single bad block can't crash the whole preview tree.

## Template + orchestrator changes (prerequisite for everything that follows)

The current `sitegen-template` is `output: 'static'` with no Preact integration. The orchestrator's `site-converter` agent (Group 1) already converts each tenant's site to `output: 'server'` + `@astrojs/node` adapter — so SSR is in place by the time a `__preview` route would run. We extend that flow:

1. **`sitegen-template/package.json`** — add `@astrojs/preact` and `preact` as dependencies.
2. **`sitegen-template/astro.config.mjs`** — register `preact()` integration with `compat: false` and `include: ['**/cms/*.tsx']` to scope it. (Stays `output: 'static'` here; the orchestrator flips to `'server'` per-tenant.)
3. **`sitegen-cms-orchestrator/.claude/agents/site-converter.md`** — explicitly amend Group 1's "never modify dependencies after Group 1" rule to permit the `@astrojs/preact` install during conversion. Currently Group 1 only installs `@astrojs/node`. The amendment treats `@astrojs/preact` as a Group-1 sibling install, then re-locks dependencies. This is a deliberate carve-out, not a precedent for arbitrary deps.
4. **`Blocks.astro`** (in site-converter Group 2): rewrite the switch-on-blockType to dispatch all 7 block types (currently only `richText`). Renders each block's `.tsx` component server-only on tenant pages (zero JS), opt-in to `client:load` only on the `__preview` route.
5. **`src/lib/types.ts`** (in site-converter Group 2): extend the `Block` discriminated union beyond `RichTextBlock` to include all 7 block types. Field shapes mirror `siab-payload/src/blocks/*.ts`.

These changes land as part of Wave 3's sub-waves (3a + 3b for the renderers, with the Preact + middleware + Blocks.astro + types.ts plumbing folded into 3a so 3b ships pure renderer code). The orchestrator agent edits land in lock-step with the template edits — a Wave-3 commit on `sitegen-cms-orchestrator` mirrors the template work.

## Preview route

### `sitegen-template/src/pages/__preview.astro`

**Server-side (request handler):**
```ts
const token = Astro.url.searchParams.get('t')
const ok = verifyHmac(token, import.meta.env.PREVIEW_HMAC_SECRET)
if (!ok) return new Response('Unauthorized', { status: 401 })
// Token claims: { tenantId, pageId, exp }. Not used server-side (island is empty
// until postMessage arrives), but signed claims are available for audit logging.
```

**Page body:**
```astro
<PreviewLayout> {/* minimal slot-only layout — see below */}
  <PreviewIsland client:load allowedOrigin={import.meta.env.PUBLIC_ADMIN_ORIGIN} />
</PreviewLayout>
```

`PreviewIsland.tsx` initially renders `null` (or a skeleton placeholder — design choice in 3c). Listens for `message` events, validates `e.origin === allowedOrigin`, swaps in `<Blocks blocks={draft.blocks} mediaResolver={previewResolver} />` when a `preview:draft` message arrives. Sends `preview:ready` once after first hydration.

**Why a separate `PreviewLayout`, not the tenant's `BaseLayout`:** real-tenant `BaseLayout` (post-conversion) includes themed `<Header>`, `<Footer>`, analytics, and possibly other site chrome. Reusing it would render the tenant's full chrome around the empty island for ~300-500ms while the island hydrates and waits for the first postMessage — a visible flash of "site frame with no content." `PreviewLayout` is a stripped slot-only wrapper that loads the tenant's CSS bundle (so theme tokens and Tailwind classes still apply) but skips chrome. Pixel-perfect for the *block content*; preview is explicitly scoped to in-progress block edits, not whole-page chrome review. (If chrome review is needed, the operator opens the deployed site in a new tab — out of MVP scope.)

### HMAC signing

**On CMS side** (`siab-payload/src/lib/preview/sign.ts` — new, ~15 lines):
```ts
export function signPreviewToken(claims: { tenantId: number; pageId: number | string }) {
  const header  = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    ...claims,
    exp: Math.floor(Date.now() / 1000) + 30 * 60,  // 30-min TTL
  }))
  const sig = crypto
    .createHmac('sha256', process.env.PREVIEW_HMAC_SECRET!)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${sig}`
}
```

**On tenant side** (`sitegen-template/src/lib/preview/verify.ts` — new, ~15 lines): inverse — split, recompute sig, constant-time compare, check `exp`. Reject anything else.

**Endpoint:** `POST /api/preview-tokens` on CMS — body `{ tenantId, pageId }`, response `{ token, exp }`. Auth via existing Payload session (admin must be logged in). Authorization: caller must have `canRead` access to the tenant (existing role helper).

### Token refresh

`useSignedPreviewToken` hook in admin:
- Mints token on mount, with an initial **safety margin** — `exp` requested by the hook is `now + 30min`, but the iframe URL embedding waits until at least 60s after mint to ensure no race against a slow load that 401s at the boundary. Practically: mint, then `iframe.src = url(token)` immediately; the 60s is tracked as a server-side "min remaining lifetime" check before any iframe re-load.
- Schedules refresh at `exp - 60s` via `setTimeout`.
- **Refreshes ALSO on `visibilitychange`** (when the tab becomes visible again) and on `window.focus`. Reason: Chrome and other browsers throttle `setTimeout` to ≥1min in background tabs, so the timer-based refresh can fire late (or after `exp`) when the operator returns from a long absence. The visibility/focus listener catches this: if the stored token's `exp - now < 60s`, hit the endpoint again immediately, then post the new token to the iframe.
- On refresh, hits `POST /api/preview-tokens` again. If the iframe is alive, sends new token via `preview:token-refresh` postMessage (iframe doesn't currently use it, but the message is sent for future-proofing if we ever add server roundtrips).
- If `exp` already passed (tab was sleeping past 30min): force iframe `src` swap with the freshly-minted token on next user interaction. Rare with 30-min TTL + visibility/focus refresh, but the swap is the recovery path. Stored in a ref so the swap uses the latest token, not the (possibly stale) one captured at hook closure.

## postMessage protocol

Strict envelope, both directions:

**Admin → iframe:**
```ts
{ type: 'preview:draft', version: 1, payload: { page: <Page-shaped JSON> } }
{ type: 'preview:token-refresh', version: 1, payload: { token: string } }  // future-proofing
```

**Iframe → admin:**
```ts
{ type: 'preview:ready', version: 1 }                                       // sent once after first hydration
{ type: 'preview:heartbeat', version: 1, ts: number }                       // every 30s
{ type: 'preview:error', version: 1, message: string, blockType?: string }  // graceful failures
```

`targetOrigin` discipline:
- Admin always uses `iframe.contentWindow.postMessage(msg, '<tenant-origin>')` — never `'*'`.
- Iframe checks `e.origin === ADMIN_ORIGIN` on every received message and ignores mismatches.

`PUBLIC_ADMIN_ORIGIN` is baked at tenant build time via env var. The orchestrator sets it during the existing site-conversion phase.

### Heartbeat / reconnect

Iframe sends `preview:heartbeat` every 30s after `preview:ready`. Admin's `<PreviewPane>` watchdog:
- No heartbeat for 60s → toolbar status = yellow "Reconnecting…", auto-attempt fresh handshake (mint new token, iframe `src` swap).
- Reconnect succeeds within 30s → status returns to green.
- Three failed reconnects → status = red, toolbar shows "Reconnect" button for manual recovery.

### Cross-origin / CORS / framing

The orchestrator's scaffolded `src/middleware.ts` (per `site-converter.md` lines ~200-216) currently sets, on **every** response:
- `X-Frame-Options: DENY`
- `Content-Security-Policy: ... frame-ancestors 'none' ...`

Both block iframe embedding. Browsers honor `frame-ancestors` over XFO, so just relaxing XFO is insufficient. Wave 3 amends the middleware (template + lock-step `site-converter.md` edit) to branch on the request path:

```ts
// Pseudocode
const isPreview = ctx.url.pathname === '/__preview' || ctx.url.pathname.startsWith('/__preview/')
if (isPreview) {
  // Skip XFO entirely; rewrite CSP frame-ancestors to admin origin only.
  response.headers.delete('X-Frame-Options')
  response.headers.set('Content-Security-Policy', cspWith({ frameAncestors: [ADMIN_ORIGIN] }))
  response.headers.set('Access-Control-Allow-Origin', ADMIN_ORIGIN)
} else {
  // Existing strict defaults — unchanged.
}
```

- Admin's `<iframe>` uses `sandbox="allow-scripts allow-same-origin allow-forms"` (`allow-forms` is needed because `ContactSection` renders `<form>` elements; without it, render warnings/quirks vary by engine).
- CMS's `/api/media/<id>/file` already serves cross-origin (Payload defaults; verify and extend for the admin origin if needed) so iframe `<img>` tags fetch successfully.

### Sandbox-attr safety invariant

`allow-scripts allow-same-origin` together is [explicitly warned against by MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox) when the iframe is the same origin as its embedder — it allows the iframe to script-modify the embedder. **Wave 3 invariant: admin origin (e.g. `admin.siteinabox.nl`) MUST differ from the tenant origin** (e.g. `tenant-domain.com`). The CMS `<PreviewPane>` asserts this at runtime — if `tenantOrigin` resolves to the admin's own origin, render an error state and refuse to embed. This is a defensive check; under normal multi-tenant operation the origins are always different.

## Admin UI — `<PreviewPane>`

### Placement

Page editor today uses `lg:grid-cols-3` (form 2/3, sidebar 1/3). `<PreviewPane>` extends to:
- **`<lg`:** Preview lives below the form, full-width. Stacked.
- **`xl+`:** Preview becomes a third column. Layout shifts to `xl:grid-cols-[2fr_1fr_3fr]` — preview gets the most width.
- **Mobile (<sm):** Side mode collapses to a "Preview" / "Edit" tab toggle. No split.

### Mode toggle

Persistent toggle button in/near the SaveStatusBar pill switches preview between three modes:
- **Hidden** (default on first launch): full-width form, no iframe.
- **Side**: split layout per breakpoint rules above.
- **Fullscreen overlay**: preview occupies viewport with a thin form drawer on the left.

State persists in `localStorage` keyed by user.

### Component sketch

```tsx
function PreviewPane({ pageId, tenantId, draftValues, tenantOrigin }: Props) {
  const token = useSignedPreviewToken({ pageId, tenantId })
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'reconnecting' | 'error'>('loading')
  const [viewport, setViewport] = useState<'mobile' | 'laptop' | 'full'>('full')

  useMessageListener(iframeRef, tenantOrigin, {
    'preview:ready':     () => setStatus('ready'),
    'preview:heartbeat': () => /* reset watchdog */,
    'preview:error':     ({ message, blockType }) => /* surface inline */,
  })

  useDebouncedEffect(() => {
    if (status !== 'ready') return
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'preview:draft', version: 1, payload: { page: draftValues } },
      tenantOrigin,
    )
  }, [draftValues], 100)  // tunable; debug via ?dbg=debounce:50

  const widths = { mobile: 375, laptop: 1024, full: '100%' }
  return (
    <div className="flex flex-col gap-2">
      <PreviewToolbar status={status} viewport={viewport} setViewport={setViewport} onRefresh={...} />
      <iframe
        ref={iframeRef}
        src={`${tenantOrigin}/__preview?t=${token}`}
        sandbox="allow-scripts allow-same-origin allow-forms"
        style={{ width: widths[viewport], height: '100%' }}
      />
    </div>
  )
}
```

### `draftValues` source

```tsx
// Inside <PreviewPane> (NOT PageForm).
import { useWatch } from 'react-hook-form'
const draftValues = useWatch({ control })  // RHF subscribes to form state; stable identity per actual change
```

Two important localizations:

1. **`useWatch`, not `form.watch()` + `useMemo`/JSON.stringify.** Calling `form.watch()` at the parent level triggers re-renders for the entire form on every keystroke, fanning out into BlockEditor and every FieldArray child. `useWatch({ control })` subscribes only the component that calls it; PageForm and BlockEditor stay quiet during typing. (The previous spec proposed `useMemo([JSON.stringify(form.watch())])`, which is theatrical — the JSON.stringify runs every render anyway, defeating the memo's purpose.)
2. **The hook lives in `<PreviewPane>`, which is rendered inside PageForm.** `<PreviewPane>` receives `control` from PageForm via prop; subscription is local. PageForm doesn't subscribe to anything, so its render volume is unaffected by preview being toggled on or off.

### Viewport switcher

Toolbar gets three buttons (📱 / 💻 / 🖥️) that resize the iframe wrapper width to 375 / 1024 / 100%. Iframe stays full-height. Renderers are responsive Tailwind, so they adapt naturally to constrained widths. ~30 lines added to `<PreviewPane>`. No template changes.

### Loading + error UX

- **Loading** (initial iframe load): centered spinner with "Loading preview…" overlay over iframe area; fades on `preview:ready`.
- **Reconnecting** (yellow): "Reconnecting to preview…" toolbar message.
- **Error** (red): toolbar shows error + "Reconnect" button. Forces fresh token + iframe reload.
- **Block render error** (per-block): replaced inline with `[Hero block: render error]` placeholder. Logged via `preview:error`.

### Toolbar (top of preview pane)

- Status dot (green / yellow / red).
- Viewport switcher (📱 / 💻 / 🖥️).
- "Open in new tab" — opens `__preview` URL in a fresh tab for full-screen review.
- "↻ Refresh" — manual reload escape hatch (matches the operator's Q4 fallback option).

## Sub-wave decomposition

Each sub-wave is gated by a reviewer agent (Opus, given this design doc + the diff) before merge.

| Sub-wave | Scope | Repo | Approx LOC | Reviewer focus |
|---|---|---|---|---|
| **3a** | **Foundation + 3 renderers**: `@astrojs/preact` install + `astro.config.mjs` integration + `site-converter.md` Group-1 amendment + middleware route-aware framing relaxation + `Blocks.astro` switch extension + `src/lib/types.ts` Block union extension + `PreviewLayout` slot-only component + Hero, RichText (refactor — drops `heading`), CTA renderers | `sitegen-template` + `sitegen-cms-orchestrator` | ~430 | Foundation correctness, dep-lock amendment shape, middleware branching tested, prop-shape parity with CMS Block configs, BlockErrorBoundary integration |
| **3b** | **4 renderers**: FeatureList, Testimonials, FAQ, ContactSection (pure renderer code; foundation already landed in 3a) | `sitegen-template` | ~350 | Tailwind conventions, array/group field handling, lucide-icon allowlist for FeatureList |
| **3c** | `__preview` Astro page + Preact island shell + HMAC verify (`src/lib/preview/verify.ts`) | `sitegen-template` | ~200 | Token verification correctness, message validation, sandbox attrs |
| **3d** | Admin `<PreviewPane>` + iframe + `useWatch`-based draftValues + transport + token mint endpoint (`POST /api/preview-tokens` + `src/lib/preview/sign.ts`) + `useSignedPreviewToken` hook (visibility/focus refresh) + admin-origin invariant assertion + viewport switcher | `siab-payload` | ~450 | Debounce correctness via `useWatch`, cross-origin discipline, watchdog/heartbeat, viewport sizing, sandbox-origin invariant |
| **3e** | Polish: scroll preservation across form changes, loading copy refinement, error recovery edge cases | `siab-payload` + `sitegen-template` | ~150 | UX consistency, edge cases |

Total: ~1580 LOC across 5 commits, 5 reviewer passes, 5 deploys. Slightly heavier than Wave 2; 3a is the largest sub-wave because it includes the foundation work plus the first three renderers.

### Cross-wave coordination

- Sub-wave 3c can land before 3d. Tested in isolation: open `https://<tenant>/__preview?t=<test-token>` in a normal browser tab; verify it renders an empty island and accepts postMessage from a small test page.
- Sub-wave 3d depends on 3c (it embeds the route 3c builds).
- Renderers (3a + 3b) are independent of preview transport (3c + 3d). They land first because they also fix the existing "Hero is silently dropped on prod" gap.
- 3e runs last, reviews any cross-cutting issues.

## Risks + mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Preact `.tsx` server-render produces different HTML than `.astro` | Renderers use only standard JSX. Reviewer agent inspects each sub-wave for hydration warnings. |
| 2 | `form.watch()` at parent re-renders entire form per keystroke; debounce identity churn | `useWatch({ control })` localized inside `<PreviewPane>`. NOT `useMemo+JSON.stringify` (theatrical). Verify message rate via dev logging. |
| 3 | Cross-origin iframe blocked by browser policies | Route-aware middleware: skip `X-Frame-Options` on `/__preview*` AND replace CSP `frame-ancestors 'none'` with `frame-ancestors <ADMIN_ORIGIN>` (browser CSP takes precedence over XFO). Tested in 3c before admin work. |
| 4 | Image refs in draft point at media not yet on tenant disk | Preview-mode `mediaResolver` resolves to CMS origin (see Block renderers section). |
| 5 | Preact bundle on `__preview` balloons | Reviewer inspects bundle size per renderer sub-wave. Tree-shake; avoid heavy deps. |
| 6 | HMAC secret leaks | Treated like `PAYLOAD_SECRET`. Documented rotation procedure. |
| 7 | Token-expiry refresh races | Tokens validated server-side at iframe load only; postMessage carries no token. Race impossible by design. |
| 8 | Browser asleep, iframe dead | Heartbeat every 30s. 60s timeout → reconnect. |
| 9 | Fast typing during slow iframe render | React naturally last-wins. Each postMessage replaces draft entirely. |
| 10 | Renderer throws on malformed draft | `<BlockErrorBoundary>` per block — placeholder + `preview:error` message. |
| 11 | RichText `body` rendered via `set:html` / `dangerouslySetInnerHTML` is an XSS surface for non-operator-trusted input | Pre-existing posture (RichText.astro already does this). Documented as operator-trusted-content invariant: only authenticated CMS editors can write block content; CMS does not accept untrusted input into RichText.body. If/when public-facing form-driven content is ever added to a Block, dedicated sanitization pass required. |
| 12 | Preact integration absent in template; orchestrator's Group-1 dep-lock forbids new installs | Sub-wave 3a explicitly amends the contract: `@astrojs/preact` is a Group-1 sibling install of `@astrojs/node`, scoped carve-out only — not a precedent. Lock-step edit to `site-converter.md`. |
| 13 | Tenant nginx/CDN may add `X-Frame-Options: DENY` independently of Astro middleware | Verify production HTTP headers post-deploy on a test tenant before claiming Sub-wave 3c green; document in 3c reviewer focus. |

## Open issues (flag-and-defer)

- **New page (no `pageId`):** for create flow, `pageId` doesn't exist until first save. Token signs over `pageId: 'draft-<uuid>'`. Tenant `__preview` accepts the prefix as a fresh draft (no DB lookup needed). Documented; no special handling required for MVP.
- **Multi-author races:** two editors → two previews, no live sync. Existing PATCH semantics handle save conflicts.
- **Preview's effect on form's "dirty" state:** none — preview reads `form.watch()`, never writes. Confirmed.

## Acceptance criteria

Wave 3 is complete when:

1. **All 7 block types render correctly** on a deployed tenant Astro site (verified: each tenant Page renders all blocks in the seeded JSON; no `console.warn` on unknown `blockType`).
2. **Live preview opens within 1s** of toggling Side mode (initial iframe load + first hydration).
3. **postMessage updates render in <100ms** of the trailing-edge debounce settling (verified by dev-mode timing).
4. **Minimal iframe reloads**: exactly **1 `iframe.onload` per editing session for a single page**, excluding manual ↻ Refresh and reconnect after a watchdog timeout. Verified by counting fires in dev tools.
5. **Token refresh transparent**: refreshes during a session don't visibly affect preview (no flicker, no reconnect status flash). Refresh triggers via timer AND visibilitychange/focus.
6. **Cross-origin secured**: signed-URL gate rejects unsigned requests with 401; iframe rejects postMessage from non-admin origins; **admin origin differs from tenant origin** (sandbox-attr safety invariant); CSP `frame-ancestors` permits the admin origin only on `__preview` and `/__preview/*` routes.
7. **Viewport switcher functional**: 📱 / 💻 / 🖥️ buttons resize the preview without reloading the iframe.
8. **Reviewer agent green-light** on each of 3a-3e before merge.
9. **Operator verification** on prod for each sub-wave.

## Environment changes summary

| Variable | Set on | Purpose |
|---|---|---|
| `PREVIEW_HMAC_SECRET` | CMS + each tenant | Token signing/verification. Both sides MUST `.trim()` the value on read (defensive against trailing whitespace from `.env` files written via `echo`, which would silently mismatch the HMAC and 401 on every iframe load). |
| `PUBLIC_ADMIN_ORIGIN` | Each tenant build | Origin validation for postMessage |
| `PUBLIC_CMS_ORIGIN` | Each tenant build | Media-resolver target during preview |

Orchestrator's existing env-injection phase extended to set these three.

## Followups (deliberately deferred)

- Stakeholder share URLs (signed URL with longer TTL, view-only, configurable expiry).
- Theme system (CSS custom properties + theme registry).
- Preview of saved revisions / version history.
- Block-level diff highlighting (show what changed since last save).
- Pixel-perfect mobile/tablet device frames (current viewport switcher is approximate width only).
- Live cursor / collaborative editing.

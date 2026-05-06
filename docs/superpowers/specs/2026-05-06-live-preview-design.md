# Live Preview — Design Spec

**Date:** 2026-05-06
**Status:** Draft for operator review (brainstorm output, pre-plan)
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

| Component | Source props (CMS Block) | Notes |
|---|---|---|
| `Hero.tsx` | `eyebrow`, `headline*`, `subheadline`, `cta { label, href }`, `image` | `*` required |
| `FeatureList.tsx` | `title`, `intro`, `features[] { title*, description, icon }` | array of feature rows |
| `Testimonials.tsx` | `title`, `items[] { quote*, author*, role, avatar }` | |
| `FAQ.tsx` | `title`, `items[] { question*, answer* }` | |
| `CTA.tsx` | `headline`, `body`, `primaryButton { label, href }`, `secondaryButton { label, href }` | |
| `RichText.tsx` | `heading`, `body` (HTML) | refactor of existing `.astro` to `.tsx` |
| `ContactSection.tsx` | `title`, `intro`, `formName`, `fields[] { name, label, type, required }` | type enum: `text` / `email` / `tel` / `textarea` |

Each component wrapped at usage site by a `<BlockErrorBoundary>` so a single bad block can't crash the whole preview tree.

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
<BaseLayout> {/* same layout the real site uses, so theme/CSS/fonts load */}
  <PreviewIsland client:load allowedOrigin={import.meta.env.PUBLIC_ADMIN_ORIGIN} />
</BaseLayout>
```

`PreviewIsland.tsx` initially renders `null`. Listens for `message` events, validates `e.origin === allowedOrigin`, swaps in `<Blocks blocks={draft.blocks} mediaResolver={previewResolver} />` when a `preview:draft` message arrives. Sends `preview:ready` once after first hydration.

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
- Mints token on mount.
- Schedules refresh at `exp - 60s` via `setTimeout`.
- On refresh, hits the endpoint again. If the iframe is still alive, sends new token via `preview:token-refresh` postMessage (iframe doesn't currently use it, but the message is sent for future-proofing in case we ever add server roundtrips).
- If `exp` already passed (tab was sleeping): full iframe `src` swap on next user interaction. Rare with 30-min TTL.

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

### Cross-origin / CORS

- Tenant Astro middleware (`src/middleware.ts` — already scaffolded by the orchestrator's `site-converter`) sets `Access-Control-Allow-Origin: <ADMIN_ORIGIN>` on responses for `__preview` and `__preview/*`. No `X-Frame-Options: DENY` on this route.
- Admin's `<iframe>` uses `sandbox="allow-scripts allow-same-origin"`.
- CMS's `/api/media/<id>/file` already serves cross-origin (Payload defaults; verify and extend for the admin origin if needed) so iframe `<img>` tags fetch successfully.

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
        sandbox="allow-scripts allow-same-origin"
        style={{ width: widths[viewport], height: '100%' }}
      />
    </div>
  )
}
```

### `draftValues` source

```tsx
// PageForm.tsx
const draftValues = useMemo(
  () => form.watch(),
  [JSON.stringify(form.watch())],  // identity-stable across renders
)
```

`form.watch()` returns live form state on every change. The `useMemo` with stringified identity prevents the debounce from being defeated by reference churn.

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
| **3a** | Hero, RichText (refactor), CTA renderers | `sitegen-template` | ~250 | Tailwind conventions, prop-shape parity with CMS Block configs, BlockErrorBoundary integration |
| **3b** | FeatureList, Testimonials, FAQ, ContactSection renderers | `sitegen-template` | ~350 | Same as 3a + array/group field handling |
| **3c** | `__preview` Astro page + Preact island shell + HMAC verify | `sitegen-template` | ~200 | Token verification correctness, message validation, sandbox attrs, CORS |
| **3d** | Admin `<PreviewPane>` + iframe + transport + token mint endpoint + viewport switcher | `siab-payload` | ~400 | Debounce correctness, cross-origin discipline, watchdog/heartbeat, viewport sizing |
| **3e** | Polish: scroll preservation across form changes, loading copy refinement, error recovery edge cases | `siab-payload` + `sitegen-template` | ~150 | UX consistency, edge cases |

Total: ~1350 LOC across 5 commits, 5 reviewer passes, 5 deploys. Roughly comparable to Wave 2 in volume.

### Cross-wave coordination

- Sub-wave 3c can land before 3d. Tested in isolation: open `https://<tenant>/__preview?t=<test-token>` in a normal browser tab; verify it renders an empty island and accepts postMessage from a small test page.
- Sub-wave 3d depends on 3c (it embeds the route 3c builds).
- Renderers (3a + 3b) are independent of preview transport (3c + 3d). They land first because they also fix the existing "Hero is silently dropped on prod" gap.
- 3e runs last, reviews any cross-cutting issues.

## Risks + mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Preact `.tsx` server-render produces different HTML than `.astro` | Renderers use only standard JSX. Reviewer agent inspects each sub-wave for hydration warnings. |
| 2 | `form.watch()` returning fresh identity defeats debounce | `useMemo` over stringified values, or RHF's `useWatch` with explicit deps. Verify message rate via dev logging. |
| 3 | Cross-origin iframe blocked by browser policies | Tenant nginx CORS + no `X-Frame-Options: DENY`. Tested in 3c before admin work. |
| 4 | Image refs in draft point at media not yet on tenant disk | Preview-mode `mediaResolver` resolves to CMS origin (see Block renderers section). |
| 5 | Preact bundle on `__preview` balloons | Reviewer inspects bundle size per renderer sub-wave. Tree-shake; avoid heavy deps. |
| 6 | HMAC secret leaks | Treated like `PAYLOAD_SECRET`. Documented rotation procedure. |
| 7 | Token-expiry refresh races | Tokens validated server-side at iframe load only; postMessage carries no token. Race impossible by design. |
| 8 | Browser asleep, iframe dead | Heartbeat every 30s. 60s timeout → reconnect. |
| 9 | Fast typing during slow iframe render | React naturally last-wins. Each postMessage replaces draft entirely. |
| 10 | Renderer throws on malformed draft | `<BlockErrorBoundary>` per block — placeholder + `preview:error` message. |

## Open issues (flag-and-defer)

- **New page (no `pageId`):** for create flow, `pageId` doesn't exist until first save. Token signs over `pageId: 'draft-<uuid>'`. Tenant `__preview` accepts the prefix as a fresh draft (no DB lookup needed). Documented; no special handling required for MVP.
- **Multi-author races:** two editors → two previews, no live sync. Existing PATCH semantics handle save conflicts.
- **Preview's effect on form's "dirty" state:** none — preview reads `form.watch()`, never writes. Confirmed.

## Acceptance criteria

Wave 3 is complete when:

1. **All 7 block types render correctly** on a deployed tenant Astro site (verified: each tenant Page renders all blocks in the seeded JSON; no `console.warn` on unknown `blockType`).
2. **Live preview opens within 1s** of toggling Side mode (initial iframe load + first hydration).
3. **postMessage updates render in <100ms** of the trailing-edge debounce settling (verified by dev-mode timing).
4. **No iframe reloads** during a sustained editing session (verified by counting `iframe.onload` fires — should be 1 per session).
5. **Token refresh transparent**: refreshes during a session don't visibly affect preview (no flicker, no reconnect status flash).
6. **Cross-origin secured**: signed-URL gate rejects unsigned requests with 401; iframe rejects postMessage from non-admin origins.
7. **Viewport switcher functional**: 📱 / 💻 / 🖥️ buttons resize the preview without reloading the iframe.
8. **Reviewer agent green-light** on each of 3a-3e before merge.
9. **Operator verification** on prod for each sub-wave.

## Environment changes summary

| Variable | Set on | Purpose |
|---|---|---|
| `PREVIEW_HMAC_SECRET` | CMS + each tenant | Token signing/verification |
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

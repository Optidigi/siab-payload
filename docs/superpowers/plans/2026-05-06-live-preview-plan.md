# Live Preview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time WYSIWYG-ish preview pane in the Page editor that renders the deployed Astro tenant site as the operator types, with sub-100ms updates over postMessage and pixel-perfect fidelity. Also closes the pre-existing renderer gap (only RichText currently renders on tenant sites; Hero/FAQ/CTA/etc. are silently dropped).

**Architecture:** Three repos. Tenant Astro site is already SSR-on-Node post-orchestrator-conversion; we add a `/__preview` route to it that hydrates a Preact island listening for postMessage from `admin.siteinabox.nl`. Block renderers are written once as Preact `.tsx`, server-rendered on tenant pages (0 KB JS) and `client:load`-hydrated only on the preview route. Auth via short-lived (30 min) HMAC-signed iframe URL. Form changes in admin debounced through `useWatch` to keystroke-rate postMessage updates.

**Tech Stack:** Next.js 15 App Router + react-hook-form + Zod (CMS); Astro 5 + `@astrojs/preact` + `@astrojs/node` (per-tenant SSR); HMAC-SHA256 via `node:crypto`; postMessage API. Vitest for unit tests on the CMS side; tsx-based unit tests on the template side.

**Spec:** `docs/superpowers/specs/2026-05-06-live-preview-design.md` (committed `5aff1d6`).

**Sub-wave gating:** After each sub-wave's tasks land + the diff is committed, dispatch a reviewer agent (Opus, given the spec + diff) before merging to `main`. Operator verifies on prod after each merge. Then proceed to the next sub-wave.

---

## File structure

### `sitegen-template` (Astro template — pulled by orchestrator into per-tenant `optidigi/site-<slug>`)

**Created:**
- `src/components/cms/Hero.tsx` — Hero block renderer (Preact)
- `src/components/cms/FeatureList.tsx` — FeatureList block renderer
- `src/components/cms/Testimonials.tsx` — Testimonials block renderer
- `src/components/cms/FAQ.tsx` — FAQ block renderer
- `src/components/cms/CTA.tsx` — CTA block renderer
- `src/components/cms/RichText.tsx` — RichText block renderer (refactor of existing `RichText.astro`)
- `src/components/cms/ContactSection.tsx` — ContactSection block renderer
- `src/components/cms/BlockErrorBoundary.tsx` — per-block error boundary
- `src/components/cms/icons.ts` — lucide icon allowlist for FeatureList
- `src/layouts/PreviewLayout.astro` — slot-only layout for `__preview` route (skips Header/Footer chrome)
- `src/pages/__preview.astro` — server-rendered preview entry; HMAC gate
- `src/components/preview/PreviewIsland.tsx` — Preact island; postMessage listener, draft swap
- `src/lib/preview/verify.ts` — HMAC verification (mirror of CMS sign.ts)
- `tests/preview-verify.test.ts` — unit test for verify roundtrip

**Modified:**
- `package.json` — add `@astrojs/preact`, `preact`
- `astro.config.mjs` — register `preact()` integration

### `sitegen-cms-orchestrator` (workflow agent)

**Modified:**
- `.claude/agents/site-converter.md` — Group-1 dep amendment (allow `@astrojs/preact`); Group-2 codeblock updates for `Blocks.astro` (full switch), `src/lib/types.ts` (full Block union), `src/middleware.ts` (route-aware framing relaxation on `/__preview*`)

### `siab-payload` (CMS — this repo)

**Created:**
- `src/lib/preview/sign.ts` — HMAC token signing
- `src/app/(payload)/api/preview-tokens/route.ts` — `POST /api/preview-tokens` endpoint
- `src/components/editor/PreviewPane.tsx` — iframe wrapper component
- `src/components/editor/PreviewToolbar.tsx` — status dot + viewport switcher + Refresh + Open-in-new-tab
- `src/components/editor/useSignedPreviewToken.ts` — token mint + visibility/focus refresh hook
- `src/components/editor/useDebouncedPostMessage.ts` — debounced postMessage emitter
- `src/components/editor/usePreviewMessageListener.ts` — listen for `preview:ready`/`heartbeat`/`error`
- `tests/unit/preview-sign.test.ts` — unit test for sign + roundtrip with verify
- `tests/integration/preview-tokens.test.ts` — endpoint integration test

**Modified:**
- `.env.example` — add `PREVIEW_HMAC_SECRET`, `PUBLIC_TENANT_ORIGIN_TEMPLATE` (or per-tenant resolution)
- `src/components/forms/PageForm.tsx` — render `<PreviewPane>` when toggle is on; pass `control` + `tenantId`/`tenantOrigin`
- `src/components/editor/SaveStatusBar.tsx` — add preview-mode toggle button
- `docker-compose.yml` (root) — pass `PREVIEW_HMAC_SECRET` env to container

---

## Pre-flight (before sub-wave 3a)

- [ ] **Step P1: Verify pre-conditions on `main`**

```bash
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload
git status
git log --oneline -3
```

Expected: clean working tree, HEAD is `5aff1d6` (the approved spec commit). If anything uncommitted, deal with it before starting.

- [ ] **Step P2: Verify cross-repo siblings exist + on main**

```bash
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload/sitegen-template
git status && git log --oneline -1
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload/sitegen-cms-orchestrator
git status && git log --oneline -1
```

Expected: both clean, on main, recent commits.

---

# Sub-wave 3a — Foundation + 3 renderers (Hero, RichText, CTA)

**Repo coverage:** `sitegen-template` (primary) + `sitegen-cms-orchestrator` (Group-1 amendment + Group-2 scaffold updates).

**Goal:** After 3a lands, every tenant site has `@astrojs/preact` integrated, a fully-extended `Blocks.astro` switch + `Block` type union, route-aware middleware that allows iframing on `/__preview*`, the `PreviewLayout`, the `BlockErrorBoundary`, and the first three block renderers (Hero, RichText, CTA). Live preview is NOT wired yet (that's 3c+3d). Tenant pages render Hero/RichText/CTA blocks correctly server-side.

**Branch:** `wave-3a-foundation-and-three-renderers` on each of `sitegen-template` and `sitegen-cms-orchestrator`.

### Task 3a.1: Add Preact integration to template

**Files:**
- Modify: `sitegen-template/package.json`
- Modify: `sitegen-template/astro.config.mjs`

- [ ] **Step 1: Create branch in template repo**

```bash
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload/sitegen-template
git checkout -b wave-3a-foundation-and-three-renderers
```

- [ ] **Step 2: Install Preact integration**

```bash
pnpm add @astrojs/preact preact
```

Expected: package.json has `@astrojs/preact` in dependencies, `preact` in dependencies, pnpm-lock.yaml updated.

- [ ] **Step 3: Register integration in astro.config.mjs**

Read `astro.config.mjs`, add the import and integration:

```js
import preact from "@astrojs/preact"
// ... existing imports

export default defineConfig({
  // ... existing config
  integrations: [
    sitemap(),
    // Preact is scoped to the cms/ directory only. compat:false avoids
    // pulling in React-compatibility shims we don't need; include glob
    // ensures Astro treats only these files as Preact components (the
    // rest of the site stays Astro-only).
    preact({
      compat: false,
      include: ["**/components/cms/**", "**/components/preview/**"],
    }),
    // ... existing integrations after this
  ],
  // ... rest of config unchanged
})
```

- [ ] **Step 4: Verify build still works**

```bash
pnpm build
```

Expected: build exits 0. The template still has `output: "static"` here — Preact components are server-rendered to HTML during build with no JS shipped (because no `client:*` directive is used yet). Build output should be the same shape as before.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml astro.config.mjs
git commit -m "chore: add @astrojs/preact + preact for cms block renderers"
```

### Task 3a.2: PreviewLayout slot-only layout

**Files:**
- Create: `sitegen-template/src/layouts/PreviewLayout.astro`

- [ ] **Step 1: Create the layout file**

```astro
---
// PreviewLayout.astro — used ONLY by /__preview.
//
// Why a separate layout (not BaseLayout): real-tenant BaseLayout
// includes themed Header/Footer/analytics. Reusing it would render
// full chrome around the empty island for ~300-500ms while it waits
// for the first postMessage — visible "site frame with no content"
// flash. PreviewLayout is slot-only so the operator sees only the
// in-progress block content, with the tenant's CSS bundle loaded
// (theme tokens + Tailwind classes still apply).
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
    <meta name="robots" content="noindex, nofollow" />
    {/* Tenant CSS bundle is loaded automatically by Astro's component
        graph when blocks reference it. We don't import any header/footer
        components here. */}
  </head>
  <body>
    <main>
      <slot />
    </main>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/layouts/PreviewLayout.astro
git commit -m "feat(preview): add slot-only PreviewLayout for /__preview route"
```

### Task 3a.3: BlockErrorBoundary

**Files:**
- Create: `sitegen-template/src/components/cms/BlockErrorBoundary.tsx`

- [ ] **Step 1: Create the boundary component**

```tsx
import { Component, type ComponentChildren, type ComponentType } from "preact"

/**
 * Per-block error boundary.
 *
 * Wraps each block renderer at usage site. If a block component throws
 * during render (malformed draft, unexpected null, schema drift), this
 * catches it and renders a small placeholder instead of crashing the
 * whole preview tree. Logs via window.postMessage so the admin's
 * watchdog can surface the error in the toolbar.
 */
type Props = {
  blockType: string
  children: ComponentChildren
}

type State = {
  hasError: boolean
  message?: string
}

export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    }
  }

  componentDidCatch(err: unknown) {
    // Best-effort report to admin parent. Safe to fail silently if there's
    // no parent (e.g., this component is somehow rendered standalone).
    if (typeof window !== "undefined" && window.parent !== window) {
      try {
        window.parent.postMessage(
          {
            type: "preview:error",
            version: 1,
            message: this.state.message ?? "render error",
            blockType: this.props.blockType,
          },
          "*", // We don't know admin origin here; admin's listener checks origin and ignores mismatch.
        )
      } catch {
        // Silently ignore — we tried.
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "1rem",
            margin: "0.5rem 0",
            border: "1px dashed #d97706",
            background: "#fef3c7",
            color: "#92400e",
            fontFamily: "monospace",
            fontSize: "0.875rem",
          }}
        >
          [{this.props.blockType} block: render error] {this.state.message}
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cms/BlockErrorBoundary.tsx
git commit -m "feat(cms): add per-block error boundary with admin postMessage report"
```

### Task 3a.4: Hero renderer

**Files:**
- Create: `sitegen-template/src/components/cms/Hero.tsx`

- [ ] **Step 1: Create the Hero component**

```tsx
import type { ComponentChildren } from "preact"

/**
 * Hero block renderer (Preact).
 *
 * Server-rendered on tenant pages (0 KB JS). On the /__preview route,
 * hydrates client-side via PreviewIsland so postMessage updates trigger
 * React reconciliation in <50ms.
 *
 * Props mirror siab-payload/src/blocks/Hero.ts exactly. Optional fields
 * render gracefully — important for live-preview UX where fields fill
 * in mid-edit.
 */
export type HeroProps = {
  eyebrow?: string | null
  headline: string  // required by CMS Block
  subheadline?: string | null
  cta?: {
    label?: string | null
    href?: string | null
  } | null
  // image is resolved to a URL by Blocks.astro before reaching here.
  // Preview-mode resolver points at CMS origin; production at tenant disk.
  imageUrl?: string | null
  imageAlt?: string | null
}

export default function Hero({
  eyebrow,
  headline,
  subheadline,
  cta,
  imageUrl,
  imageAlt,
}: HeroProps) {
  const ctaLabel = cta?.label?.trim()
  const ctaHref = cta?.href?.trim()
  const showCta = ctaLabel && ctaHref

  return (
    <section class="cms-block cms-block--hero py-16 md:py-24">
      <div class="container mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
        <div class="space-y-4">
          {eyebrow && (
            <p class="text-sm font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </p>
          )}
          <h1 class="text-4xl md:text-5xl font-bold tracking-tight">
            {headline}
          </h1>
          {subheadline && (
            <p class="text-lg text-muted-foreground">{subheadline}</p>
          )}
          {showCta && (
            <a
              href={ctaHref}
              class="inline-block rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {ctaLabel}
            </a>
          )}
        </div>
        {imageUrl && (
          <div class="md:order-last">
            <img
              src={imageUrl}
              alt={imageAlt ?? ""}
              class="w-full h-auto rounded-lg shadow-lg"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cms/Hero.tsx
git commit -m "feat(cms): add Hero block renderer (Preact)"
```

### Task 3a.5: RichText renderer (refactor from .astro)

**Files:**
- Create: `sitegen-template/src/components/cms/RichText.tsx`
- Note: existing `src/components/cms/RichText.astro` is in the orchestrator's Group-2 scaffold, not in the template repo. This task creates the `.tsx` here; the orchestrator-side file is replaced via the Group-2 update in Task 3a.10.

- [ ] **Step 1: Create the RichText component**

```tsx
/**
 * RichText block renderer (Preact).
 *
 * v1: `body` is a plain textarea field in the CMS Block. The orchestrator's
 * scaffolded converter renders body via dangerouslySetInnerHTML to support
 * pre-serialized HTML from Payload. This is operator-trusted content —
 * only authenticated CMS editors write block content; we do not accept
 * untrusted input here.
 *
 * v2 (per the CMS field admin comment) plans a Tiptap-backed editor;
 * renderer swaps with no API change.
 *
 * NOTE: spec drops the `heading` field that the prior .astro accepted —
 * the CMS Block doesn't define it.
 */
export type RichTextProps = {
  body: string  // required by CMS Block
}

export default function RichText({ body }: RichTextProps) {
  if (!body) return null
  return (
    <section class="cms-block cms-block--richtext py-12 md:py-16">
      <div
        class="container mx-auto px-4 prose prose-lg max-w-3xl"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cms/RichText.tsx
git commit -m "feat(cms): add RichText block renderer (Preact, refactor from .astro)"
```

### Task 3a.6: CTA renderer

**Files:**
- Create: `sitegen-template/src/components/cms/CTA.tsx`

- [ ] **Step 1: Create the CTA component**

```tsx
/**
 * CTA block renderer (Preact).
 *
 * Props mirror siab-payload/src/blocks/CTA.ts:
 *  - headline: required text
 *  - description: optional textarea
 *  - primary: group { label*, href* }
 *  - secondary: group { label, href }
 */
export type CTAProps = {
  headline: string  // required
  description?: string | null
  primary?: {
    label?: string | null
    href?: string | null
  } | null
  secondary?: {
    label?: string | null
    href?: string | null
  } | null
}

export default function CTA({
  headline,
  description,
  primary,
  secondary,
}: CTAProps) {
  const primaryLabel = primary?.label?.trim()
  const primaryHref = primary?.href?.trim()
  const showPrimary = primaryLabel && primaryHref

  const secondaryLabel = secondary?.label?.trim()
  const secondaryHref = secondary?.href?.trim()
  const showSecondary = secondaryLabel && secondaryHref

  return (
    <section class="cms-block cms-block--cta py-16 md:py-20">
      <div class="container mx-auto px-4 text-center max-w-3xl">
        <h2 class="text-3xl md:text-4xl font-bold tracking-tight">
          {headline}
        </h2>
        {description && (
          <p class="mt-4 text-lg text-muted-foreground">{description}</p>
        )}
        {(showPrimary || showSecondary) && (
          <div class="mt-8 flex flex-wrap justify-center gap-3">
            {showPrimary && (
              <a
                href={primaryHref}
                class="inline-block rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {primaryLabel}
              </a>
            )}
            {showSecondary && (
              <a
                href={secondaryHref}
                class="inline-block rounded-md border border-border bg-background px-6 py-3 font-medium hover:bg-accent transition-colors"
              >
                {secondaryLabel}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cms/CTA.tsx
git commit -m "feat(cms): add CTA block renderer (Preact)"
```

### Task 3a.7: Type-check the renderers

**Files:** none modified

- [ ] **Step 1: Run Astro check**

```bash
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload/sitegen-template
pnpm astro check
```

Expected: 0 errors. If errors, fix inline; do NOT proceed until clean.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: build exits 0. The new components are not yet imported anywhere (they'll be wired in via the orchestrator's Group-2 update in 3a.10), so this just verifies they compile correctly.

### Task 3a.8: Site-converter.md — Group-1 dep amendment

**Files:**
- Modify: `sitegen-cms-orchestrator/.claude/agents/site-converter.md` (Group 1 section, ~line 744)

- [ ] **Step 1: Create branch**

```bash
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload/sitegen-cms-orchestrator
git checkout -b wave-3a-foundation-and-three-renderers
```

- [ ] **Step 2: Read Group-1 section**

Read `.claude/agents/site-converter.md` around line 744. Locate the rule "Never modify dependencies after Group 1." and the existing `pnpm add @astrojs/node` line.

- [ ] **Step 3: Amend the rule**

Find the relevant block (search for "Never modify dependencies after Group 1") and update:

```markdown
**Group 1 — Dependencies + Astro config (single carve-out window).**

Install ALL of these in Group 1. Never modify dependencies after Group 1
(carve-out: `@astrojs/preact` and `preact` are sibling installs of
`@astrojs/node`, added for the live-preview block-renderer story; this
is a one-time exception, not a precedent for arbitrary deps).

Run from the cloned site repo root:

```bash
pnpm add @astrojs/node @astrojs/preact preact
```

Then update `astro.config.mjs`:

```js
import { defineConfig } from "astro/config"
import sitemap from "@astrojs/sitemap"
import node from "@astrojs/node"
import preact from "@astrojs/preact"

export default defineConfig({
  site: "https://<primaryDomain>",
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [
    sitemap(),
    preact({
      compat: false,
      include: ["**/components/cms/**", "**/components/preview/**"],
    }),
  ],
})
```
```

(Replace the Group-1 codeblock(s) accordingly. Match the existing voice/format of the surrounding text.)

- [ ] **Step 4: Commit the Group-1 amendment**

```bash
git add .claude/agents/site-converter.md
git commit -m "feat(site-converter): permit @astrojs/preact in Group 1 for live preview renderers"
```

### Task 3a.9: Site-converter.md — Group-2 middleware update (route-aware framing)

**Files:**
- Modify: `sitegen-cms-orchestrator/.claude/agents/site-converter.md` (middleware section, ~line 200)

- [ ] **Step 1: Read the middleware section**

Locate the middleware codeblock around line 200. It currently sets `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` on every response.

- [ ] **Step 2: Replace with route-aware version**

Update the middleware codeblock to:

```ts
// src/middleware.ts
import { defineMiddleware } from "astro:middleware"

const ADMIN_ORIGIN = process.env.PUBLIC_ADMIN_ORIGIN ?? "https://admin.siteinabox.nl"

export const onRequest = defineMiddleware(async (ctx, next) => {
  const res = await next()

  // Common security headers (unchanged from prior version).
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")

  const isPreview =
    ctx.url.pathname === "/__preview" || ctx.url.pathname.startsWith("/__preview/")

  if (isPreview) {
    // Allow framing by the admin origin only.
    res.headers.delete("X-Frame-Options")
    res.headers.set(
      "Content-Security-Policy",
      // Note: 'unsafe-inline' kept narrow; preview hydration uses no
      // dynamic eval. frame-ancestors permits ONLY admin origin.
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ${ADMIN_ORIGIN}; frame-ancestors ${ADMIN_ORIGIN}`,
    )
    res.headers.set("Access-Control-Allow-Origin", ADMIN_ORIGIN)
    res.headers.set("Vary", "Origin")
  } else {
    // Strict defaults for non-preview routes (unchanged).
    res.headers.set("X-Frame-Options", "DENY")
    res.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-ancestors 'none'",
    )
  }

  return res
})
```

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/site-converter.md
git commit -m "feat(site-converter): route-aware framing relaxation for /__preview"
```

### Task 3a.10: Site-converter.md — Group-2 Blocks.astro + types extension

**Files:**
- Modify: `sitegen-cms-orchestrator/.claude/agents/site-converter.md` (Blocks.astro section ~line 273; types.ts section ~line 95)

- [ ] **Step 1: Replace Blocks.astro codeblock**

Locate the existing `Blocks.astro` codeblock (search for "Create `src/components/cms/Blocks.astro`"). Replace with:

```astro
---
import Hero from "./Hero.tsx"
import FeatureList from "./FeatureList.tsx"
import Testimonials from "./Testimonials.tsx"
import FAQ from "./FAQ.tsx"
import CTA from "./CTA.tsx"
import RichText from "./RichText.tsx"
import ContactSection from "./ContactSection.tsx"
import { BlockErrorBoundary } from "./BlockErrorBoundary.tsx"
import type { Block } from "../../lib/types"

interface Props {
  blocks?: Block[] | null
  // resolveMedia takes a Media id and returns a URL string. Production
  // resolves to tenant disk path (`/media/<id>/file.<ext>`); preview-mode
  // resolves to CMS origin (`<PUBLIC_CMS_ORIGIN>/api/media/<id>/file`).
  // Default = production resolver.
  resolveMedia?: (id: number | string | null | undefined) => string | null
  // hydrate=true wraps each block in `<Component client:load>` so the
  // /__preview route can swap props via React reconciliation. Default
  // false = pure SSR with 0 KB JS on tenant pages.
  hydrate?: boolean
}

const { blocks, resolveMedia, hydrate = false } = Astro.props
const list = blocks ?? []
const resolve = resolveMedia ?? ((id) => (id == null ? null : `/media/${id}/file.jpg`))
---

{
  list.map((block) => {
    if (block.blockType === "hero") {
      const props = {
        ...block,
        imageUrl: resolve(block.image),
        imageAlt: null,
      }
      return (
        <BlockErrorBoundary blockType="hero" client:load={hydrate}>
          <Hero {...props} client:load={hydrate} />
        </BlockErrorBoundary>
      )
    }
    if (block.blockType === "featureList") {
      return (
        <BlockErrorBoundary blockType="featureList" client:load={hydrate}>
          <FeatureList {...block} client:load={hydrate} />
        </BlockErrorBoundary>
      )
    }
    if (block.blockType === "testimonials") {
      const items = (block.items ?? []).map((item) => ({
        ...item,
        avatarUrl: resolve(item.avatar),
      }))
      return (
        <BlockErrorBoundary blockType="testimonials" client:load={hydrate}>
          <Testimonials title={block.title} items={items} client:load={hydrate} />
        </BlockErrorBoundary>
      )
    }
    if (block.blockType === "faq") {
      return (
        <BlockErrorBoundary blockType="faq" client:load={hydrate}>
          <FAQ {...block} client:load={hydrate} />
        </BlockErrorBoundary>
      )
    }
    if (block.blockType === "cta") {
      return (
        <BlockErrorBoundary blockType="cta" client:load={hydrate}>
          <CTA {...block} client:load={hydrate} />
        </BlockErrorBoundary>
      )
    }
    if (block.blockType === "richText") {
      return (
        <BlockErrorBoundary blockType="richText" client:load={hydrate}>
          <RichText body={block.body} client:load={hydrate} />
        </BlockErrorBoundary>
      )
    }
    if (block.blockType === "contactSection") {
      return (
        <BlockErrorBoundary blockType="contactSection" client:load={hydrate}>
          <ContactSection {...block} client:load={hydrate} />
        </BlockErrorBoundary>
      )
    }
    console.warn(`[cms/Blocks] unknown blockType: ${(block as any).blockType}`)
    return null
  })
}
```

- [ ] **Step 2: Replace types.ts Block union**

Locate the `src/lib/types.ts` codeblock (search for "RichTextBlock"). Replace with:

```ts
// src/lib/types.ts — auto-scaffolded shape; mirrors siab-payload/src/blocks/*.ts.

export type HeroBlock = {
  blockType: "hero"
  eyebrow?: string | null
  headline: string
  subheadline?: string | null
  cta?: { label?: string | null; href?: string | null } | null
  image?: number | string | null  // Media id; resolved by Blocks.astro
}

export type FeatureListBlock = {
  blockType: "featureList"
  title?: string | null
  intro?: string | null
  features: Array<{
    title: string
    description?: string | null
    icon?: string | null  // lucide-react icon name
  }>
}

export type TestimonialsBlock = {
  blockType: "testimonials"
  title?: string | null
  items: Array<{
    quote: string
    author: string
    role?: string | null
    avatar?: number | string | null  // Media id
  }>
}

export type FAQBlock = {
  blockType: "faq"
  title?: string | null
  items: Array<{ question: string; answer: string }>
}

export type CTABlock = {
  blockType: "cta"
  headline: string
  description?: string | null
  primary?: { label?: string | null; href?: string | null } | null
  secondary?: { label?: string | null; href?: string | null } | null
}

export type RichTextBlock = {
  blockType: "richText"
  body: string
}

export type ContactSectionBlock = {
  blockType: "contactSection"
  title?: string | null
  description?: string | null
  formName: string
  fields: Array<{
    name: string
    label: string
    type: "text" | "email" | "tel" | "textarea"
    required?: boolean
  }>
}

export type Block =
  | HeroBlock
  | FeatureListBlock
  | TestimonialsBlock
  | FAQBlock
  | CTABlock
  | RichTextBlock
  | ContactSectionBlock
```

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/site-converter.md
git commit -m "feat(site-converter): extend Blocks.astro switch + types.ts union to all 7 block types"
```

### Task 3a.11: Push 3a branches + dispatch reviewer agent

- [ ] **Step 1: Push template branch**

```bash
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload/sitegen-template
git push origin wave-3a-foundation-and-three-renderers
```

- [ ] **Step 2: Push orchestrator branch**

```bash
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload/sitegen-cms-orchestrator
git push origin wave-3a-foundation-and-three-renderers
```

- [ ] **Step 3: Dispatch reviewer agent**

From the parent session in `siab-payload`, dispatch an Opus reviewer with:
- Spec: `docs/superpowers/specs/2026-05-06-live-preview-design.md`
- Plan: this file
- Diffs: `git -C sitegen-template log --patch wave-3a-foundation-and-three-renderers...main` and `git -C sitegen-cms-orchestrator log --patch wave-3a-foundation-and-three-renderers...main`
- Brief: review for spec compliance + code quality + Tailwind conventions + prop-shape parity. Flag BLOCKING / IMPORTANT / NIT.

Expected: APPROVED or APPROVED WITH NITS. Address blockers before merge.

- [ ] **Step 4: Merge to main on both repos**

```bash
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload/sitegen-template
git checkout main && git merge --no-ff wave-3a-foundation-and-three-renderers -m "Merge wave-3a: foundation + 3 renderers (Hero, RichText, CTA)" && git push origin main && git branch -d wave-3a-foundation-and-three-renderers

cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload/sitegen-cms-orchestrator
git checkout main && git merge --no-ff wave-3a-foundation-and-three-renderers -m "Merge wave-3a: site-converter Group-1 amendment + Group-2 scaffold updates" && git push origin main && git branch -d wave-3a-foundation-and-three-renderers
```

**3a is complete.** Operator verification: there are no live tenants today, so verification is "future tenants pull these changes when next orchestrated." The Hero/RichText/CTA renderers + Blocks.astro switch + types union are now part of the standard scaffold.

---

# Sub-wave 3b — 4 remaining renderers (FeatureList, Testimonials, FAQ, ContactSection)

**Repo coverage:** `sitegen-template` only (foundation already landed in 3a).

**Goal:** All 7 block types render correctly. Tenant pages stop silently dropping blocks.

**Branch:** `wave-3b-four-renderers` on `sitegen-template`.

### Task 3b.1: Lucide icon allowlist

**Files:**
- Create: `sitegen-template/src/components/cms/icons.ts`

- [ ] **Step 1: Create branch**

```bash
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload/sitegen-template
git checkout -b wave-3b-four-renderers
```

- [ ] **Step 2: Install lucide for Preact**

```bash
pnpm add lucide-preact
```

(Preact-native version; smaller than `lucide-react` and works in Preact components without compat shims.)

- [ ] **Step 3: Create the allowlist**

```tsx
// src/components/cms/icons.ts
//
// Curated icon allowlist for FeatureList. Operators select an icon by
// string name in the CMS; we map to a Preact component here. Adding a
// new icon is a 2-line change: import + add to the map.
//
// We avoid `import * as Icons from "lucide-preact"` because it forces
// the bundler to include EVERY icon (~500 KB unzipped). Tree-shaking
// only works with named imports, so we explicitly list what we ship.

import {
  Activity,
  Award,
  BarChart,
  Bell,
  Bookmark,
  Briefcase,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  Code,
  Coffee,
  Compass,
  Copy,
  Cpu,
  Database,
  Download,
  Edit,
  ExternalLink,
  Eye,
  File,
  FileText,
  Filter,
  Flag,
  Folder,
  Gift,
  Globe,
  Grid,
  Hash,
  Heart,
  Home,
  Image,
  Inbox,
  Info,
  Layers,
  Layout,
  Link as LinkIcon,
  List,
  Lock,
  Mail,
  Map,
  MapPin,
  Maximize,
  Menu,
  MessageCircle,
  Mic,
  Monitor,
  Moon,
  MoreHorizontal,
  Move,
  Music,
  Package,
  Paperclip,
  Pause,
  PenTool,
  Phone,
  Play,
  Plus,
  Power,
  Printer,
  Radio,
  RefreshCw,
  Rocket,
  Rss,
  Save,
  Search,
  Send,
  Server,
  Settings,
  Share,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sliders,
  Smartphone,
  Star,
  Sun,
  Tag,
  Target,
  Terminal,
  ThumbsUp,
  Trash,
  TrendingUp,
  Truck,
  Tv,
  Type,
  Umbrella,
  Unlock,
  Upload,
  User,
  Users,
  Video,
  Volume,
  Wifi,
  X,
  Zap,
  ZoomIn,
} from "lucide-preact"

import type { ComponentType } from "preact"

export const ICON_MAP: Record<string, ComponentType<{ size?: number; class?: string }>> = {
  activity: Activity,
  award: Award,
  "bar-chart": BarChart,
  bell: Bell,
  bookmark: Bookmark,
  briefcase: Briefcase,
  calendar: Calendar,
  check: Check,
  "check-circle": CheckCircle,
  clock: Clock,
  code: Code,
  coffee: Coffee,
  compass: Compass,
  copy: Copy,
  cpu: Cpu,
  database: Database,
  download: Download,
  edit: Edit,
  "external-link": ExternalLink,
  eye: Eye,
  file: File,
  "file-text": FileText,
  filter: Filter,
  flag: Flag,
  folder: Folder,
  gift: Gift,
  globe: Globe,
  grid: Grid,
  hash: Hash,
  heart: Heart,
  home: Home,
  image: Image,
  inbox: Inbox,
  info: Info,
  layers: Layers,
  layout: Layout,
  link: LinkIcon,
  list: List,
  lock: Lock,
  mail: Mail,
  map: Map,
  "map-pin": MapPin,
  maximize: Maximize,
  menu: Menu,
  "message-circle": MessageCircle,
  mic: Mic,
  monitor: Monitor,
  moon: Moon,
  "more-horizontal": MoreHorizontal,
  move: Move,
  music: Music,
  package: Package,
  paperclip: Paperclip,
  pause: Pause,
  "pen-tool": PenTool,
  phone: Phone,
  play: Play,
  plus: Plus,
  power: Power,
  printer: Printer,
  radio: Radio,
  "refresh-cw": RefreshCw,
  rocket: Rocket,
  rss: Rss,
  save: Save,
  search: Search,
  send: Send,
  server: Server,
  settings: Settings,
  share: Share,
  shield: Shield,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  sliders: Sliders,
  smartphone: Smartphone,
  star: Star,
  sun: Sun,
  tag: Tag,
  target: Target,
  terminal: Terminal,
  "thumbs-up": ThumbsUp,
  trash: Trash,
  "trending-up": TrendingUp,
  truck: Truck,
  tv: Tv,
  type: Type,
  umbrella: Umbrella,
  unlock: Unlock,
  upload: Upload,
  user: User,
  users: Users,
  video: Video,
  volume: Volume,
  wifi: Wifi,
  x: X,
  zap: Zap,
  "zoom-in": ZoomIn,
}

export function resolveIcon(name: string | null | undefined) {
  if (!name) return null
  const key = name.trim().toLowerCase()
  return ICON_MAP[key] ?? null
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/cms/icons.ts
git commit -m "feat(cms): add lucide-preact icon allowlist for FeatureList"
```

### Task 3b.2: FeatureList renderer

**Files:**
- Create: `sitegen-template/src/components/cms/FeatureList.tsx`

- [ ] **Step 1: Create the FeatureList component**

```tsx
import { resolveIcon } from "./icons"

export type FeatureListProps = {
  title?: string | null
  intro?: string | null
  features: Array<{
    title: string
    description?: string | null
    icon?: string | null
  }>
}

export default function FeatureList({ title, intro, features }: FeatureListProps) {
  if (!features || features.length === 0) return null
  return (
    <section class="cms-block cms-block--featurelist py-16 md:py-20">
      <div class="container mx-auto px-4">
        {(title || intro) && (
          <div class="text-center max-w-3xl mx-auto mb-12">
            {title && (
              <h2 class="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
            )}
            {intro && (
              <p class="mt-4 text-lg text-muted-foreground">{intro}</p>
            )}
          </div>
        )}
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = resolveIcon(feature.icon)
            return (
              <div key={i} class="rounded-lg border border-border bg-card p-6">
                {Icon && <Icon size={28} class="text-primary mb-3" />}
                <h3 class="text-lg font-semibold">{feature.title}</h3>
                {feature.description && (
                  <p class="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cms/FeatureList.tsx
git commit -m "feat(cms): add FeatureList block renderer (Preact)"
```

### Task 3b.3: Testimonials renderer

**Files:**
- Create: `sitegen-template/src/components/cms/Testimonials.tsx`

- [ ] **Step 1: Create the Testimonials component**

```tsx
export type TestimonialsProps = {
  title?: string | null
  items: Array<{
    quote: string
    author: string
    role?: string | null
    avatarUrl?: string | null  // resolved by Blocks.astro
  }>
}

export default function Testimonials({ title, items }: TestimonialsProps) {
  if (!items || items.length === 0) return null
  return (
    <section class="cms-block cms-block--testimonials py-16 md:py-20 bg-muted/30">
      <div class="container mx-auto px-4">
        {title && (
          <h2 class="text-3xl md:text-4xl font-bold tracking-tight text-center mb-12">
            {title}
          </h2>
        )}
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <figure
              key={i}
              class="rounded-lg border border-border bg-background p-6 flex flex-col"
            >
              <blockquote class="flex-1 text-base leading-relaxed">
                "{item.quote}"
              </blockquote>
              <figcaption class="mt-4 flex items-center gap-3">
                {item.avatarUrl && (
                  <img
                    src={item.avatarUrl}
                    alt=""
                    class="h-10 w-10 rounded-full object-cover"
                    loading="lazy"
                  />
                )}
                <div>
                  <div class="font-semibold">{item.author}</div>
                  {item.role && (
                    <div class="text-sm text-muted-foreground">{item.role}</div>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cms/Testimonials.tsx
git commit -m "feat(cms): add Testimonials block renderer (Preact)"
```

### Task 3b.4: FAQ renderer

**Files:**
- Create: `sitegen-template/src/components/cms/FAQ.tsx`

- [ ] **Step 1: Create the FAQ component**

```tsx
export type FAQProps = {
  title?: string | null
  items: Array<{ question: string; answer: string }>
}

export default function FAQ({ title, items }: FAQProps) {
  if (!items || items.length === 0) return null
  return (
    <section class="cms-block cms-block--faq py-16 md:py-20">
      <div class="container mx-auto px-4 max-w-3xl">
        {title && (
          <h2 class="text-3xl md:text-4xl font-bold tracking-tight text-center mb-10">
            {title}
          </h2>
        )}
        <dl class="space-y-4">
          {items.map((item, i) => (
            <details
              key={i}
              class="rounded-lg border border-border bg-card p-4 group"
            >
              <summary class="cursor-pointer list-none flex items-center justify-between font-medium">
                <span>{item.question}</span>
                <span class="text-muted-foreground group-open:rotate-180 transition-transform" aria-hidden>
                  ▾
                </span>
              </summary>
              <div class="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {item.answer}
              </div>
            </details>
          ))}
        </dl>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cms/FAQ.tsx
git commit -m "feat(cms): add FAQ block renderer (Preact)"
```

### Task 3b.5: ContactSection renderer

**Files:**
- Create: `sitegen-template/src/components/cms/ContactSection.tsx`

- [ ] **Step 1: Create the ContactSection component**

```tsx
export type ContactSectionProps = {
  title?: string | null
  description?: string | null
  formName: string
  fields: Array<{
    name: string
    label: string
    type: "text" | "email" | "tel" | "textarea"
    required?: boolean
  }>
}

export default function ContactSection({
  title,
  description,
  formName,
  fields,
}: ContactSectionProps) {
  if (!fields || fields.length === 0) return null
  return (
    <section class="cms-block cms-block--contact py-16 md:py-20">
      <div class="container mx-auto px-4 max-w-2xl">
        {title && (
          <h2 class="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
        )}
        {description && (
          <p class="mt-3 text-lg text-muted-foreground">{description}</p>
        )}
        <form
          name={formName}
          method="POST"
          action="/api/forms"
          class="mt-8 space-y-4"
        >
          <input type="hidden" name="formName" value={formName} />
          {fields.map((field) => (
            <div key={field.name} class="space-y-1.5">
              <label
                htmlFor={`f-${field.name}`}
                class="block text-sm font-medium"
              >
                {field.label}
                {field.required && <span class="text-destructive"> *</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  id={`f-${field.name}`}
                  name={field.name}
                  required={!!field.required}
                  rows={5}
                  class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              ) : (
                <input
                  id={`f-${field.name}`}
                  name={field.name}
                  type={field.type}
                  required={!!field.required}
                  class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
          ))}
          <button
            type="submit"
            class="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/cms/ContactSection.tsx
git commit -m "feat(cms): add ContactSection block renderer (Preact)"
```

### Task 3b.6: Type-check + build

- [ ] **Step 1: Astro check + build**

```bash
pnpm astro check && pnpm build
```

Expected: 0 errors, build exits 0.

### Task 3b.7: Push + reviewer + merge

- [ ] **Step 1: Push branch**

```bash
git push origin wave-3b-four-renderers
```

- [ ] **Step 2: Dispatch reviewer**

Same shape as 3a.11 but scoped to the four new renderer files + icons.ts. Brief reviewer to focus on: Tailwind class conventions, prop-shape parity with `siab-payload/src/blocks/*.ts`, icon allowlist tree-shaking, ContactSection form structure.

- [ ] **Step 3: Address findings, then merge**

```bash
git checkout main && git merge --no-ff wave-3b-four-renderers -m "Merge wave-3b: 4 remaining block renderers" && git push origin main && git branch -d wave-3b-four-renderers
```

**3b is complete.** All 7 block types now render. Operator verification deferred (no live tenants).

---

# Sub-wave 3c — `__preview` route + Preact island shell + HMAC verify

**Repo coverage:** `sitegen-template` only.

**Goal:** Preview route exists, accepts a signed URL, server-renders an empty island shell, hydrates a Preact component that listens for postMessage and swaps draft content. End-to-end smoke test passes (manually): open `/__preview?t=<test-token>` in a browser, post a draft via DevTools console, see the page render.

**Branch:** `wave-3c-preview-route` on `sitegen-template`.

### Task 3c.1: Add HMAC secret env

**Files:**
- Modify: `sitegen-template/.env.example` (if it exists; else create)

- [ ] **Step 1: Create branch**

```bash
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload/sitegen-template
git checkout -b wave-3c-preview-route
```

- [ ] **Step 2: Add to .env.example**

```bash
# .env.example — append:
PUBLIC_ADMIN_ORIGIN=https://admin.siteinabox.nl
PREVIEW_HMAC_SECRET=<32-byte-hex-from-openssl-rand-hex-32>
```

(Comment in the file: "PREVIEW_HMAC_SECRET must match the value set on the CMS side. Both sides MUST `.trim()` on read to defend against trailing whitespace.")

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(preview): document PREVIEW_HMAC_SECRET + PUBLIC_ADMIN_ORIGIN env vars"
```

### Task 3c.2: HMAC verify utility (with unit test)

**Files:**
- Create: `sitegen-template/src/lib/preview/verify.ts`
- Create: `sitegen-template/tests/preview-verify.test.ts`
- Modify: `sitegen-template/package.json` (add vitest as dev dep)

- [ ] **Step 1: Install vitest**

```bash
pnpm add -D vitest
```

- [ ] **Step 2: Add npm script**

In `package.json` under `scripts`, add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Create the verify module**

```ts
// src/lib/preview/verify.ts
import crypto from "node:crypto"

export type PreviewClaims = {
  tenantId: number | string
  pageId: number | string  // numeric for saved pages, "draft-<uuid>" for unsaved
  exp: number  // unix seconds
}

/**
 * Verify a preview HMAC token. Returns the parsed claims on success,
 * or null on any failure (bad format, bad signature, expired). Constant-
 * time signature comparison; trim secret on read to defend against .env
 * trailing whitespace.
 */
export function verifyPreviewToken(
  token: string | null | undefined,
  secret: string | undefined,
): PreviewClaims | null {
  if (!token || !secret) return null
  const trimmedSecret = secret.trim()
  if (!trimmedSecret) return null

  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts

  const expectedSig = crypto
    .createHmac("sha256", trimmedSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url")

  // Constant-time compare.
  let sigA: Buffer
  let sigB: Buffer
  try {
    sigA = Buffer.from(sigB64, "base64url")
    sigB = Buffer.from(expectedSig, "base64url")
  } catch {
    return null
  }
  if (sigA.length !== sigB.length) return null
  if (!crypto.timingSafeEqual(sigA, sigB)) return null

  let claims: PreviewClaims
  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf-8")
    claims = JSON.parse(json) as PreviewClaims
  } catch {
    return null
  }

  if (typeof claims.exp !== "number") return null
  if (Math.floor(Date.now() / 1000) >= claims.exp) return null
  if (claims.tenantId == null || claims.pageId == null) return null

  return claims
}
```

- [ ] **Step 4: Create the unit test**

```ts
// tests/preview-verify.test.ts
import { describe, it, expect } from "vitest"
import crypto from "node:crypto"
import { verifyPreviewToken } from "../src/lib/preview/verify"

const SECRET = "test-secret-32-bytes-deadbeefcafe1234567890"

function signFixture(claims: { tenantId: any; pageId: any; exp: number }, secret = SECRET) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")
  return `${header}.${payload}.${sig}`
}

describe("verifyPreviewToken", () => {
  it("verifies a valid token", () => {
    const claims = { tenantId: 1, pageId: 42, exp: Math.floor(Date.now() / 1000) + 60 }
    const token = signFixture(claims)
    const result = verifyPreviewToken(token, SECRET)
    expect(result).toEqual(claims)
  })

  it("rejects a tampered payload", () => {
    const claims = { tenantId: 1, pageId: 42, exp: Math.floor(Date.now() / 1000) + 60 }
    const token = signFixture(claims)
    const parts = token.split(".")
    const altered = Buffer.from(JSON.stringify({ ...claims, tenantId: 999 })).toString("base64url")
    const tampered = `${parts[0]}.${altered}.${parts[2]}`
    expect(verifyPreviewToken(tampered, SECRET)).toBeNull()
  })

  it("rejects an expired token", () => {
    const claims = { tenantId: 1, pageId: 42, exp: Math.floor(Date.now() / 1000) - 1 }
    const token = signFixture(claims)
    expect(verifyPreviewToken(token, SECRET)).toBeNull()
  })

  it("rejects a malformed token", () => {
    expect(verifyPreviewToken("not-a-jwt", SECRET)).toBeNull()
    expect(verifyPreviewToken("", SECRET)).toBeNull()
    expect(verifyPreviewToken(null, SECRET)).toBeNull()
    expect(verifyPreviewToken(undefined, SECRET)).toBeNull()
  })

  it("rejects when secret is empty or undefined", () => {
    const claims = { tenantId: 1, pageId: 42, exp: Math.floor(Date.now() / 1000) + 60 }
    const token = signFixture(claims)
    expect(verifyPreviewToken(token, "")).toBeNull()
    expect(verifyPreviewToken(token, undefined)).toBeNull()
  })

  it("trims trailing whitespace from secret", () => {
    const claims = { tenantId: 1, pageId: 42, exp: Math.floor(Date.now() / 1000) + 60 }
    const token = signFixture(claims, SECRET)
    // Verify side has trailing newline (e.g., from `echo "..." > .env`).
    expect(verifyPreviewToken(token, `${SECRET}\n`)).toEqual(claims)
  })

  it("accepts string pageId (draft-<uuid> sentinel)", () => {
    const claims = {
      tenantId: 1,
      pageId: "draft-abc-123",
      exp: Math.floor(Date.now() / 1000) + 60,
    }
    const token = signFixture(claims)
    expect(verifyPreviewToken(token, SECRET)).toEqual(claims)
  })
})
```

- [ ] **Step 5: Run the tests**

```bash
pnpm test
```

Expected: all 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/preview/verify.ts tests/preview-verify.test.ts
git commit -m "feat(preview): HMAC verify util + unit tests"
```

### Task 3c.3: PreviewIsland Preact component

**Files:**
- Create: `sitegen-template/src/components/preview/PreviewIsland.tsx`

- [ ] **Step 1: Create the island**

```tsx
import { useEffect, useState } from "preact/hooks"
import type { Block } from "../../lib/types"

type DraftMessage = {
  type: "preview:draft"
  version: 1
  payload: { page: { blocks: Block[] } }
}

type Props = {
  allowedOrigin: string
  cmsOrigin: string  // for media resolver
}

/**
 * Preview island. Server-rendered as null; on mount (client:load) registers
 * postMessage listener. On `preview:draft` from the admin origin, swaps in
 * the rendered block tree.
 *
 * Sends:
 *  - preview:ready  once after first hydration
 *  - preview:heartbeat  every 30s after ready
 *  - preview:error  on render exceptions (caught by BlockErrorBoundary)
 */
export default function PreviewIsland({ allowedOrigin, cmsOrigin }: Props) {
  const [draft, setDraft] = useState<{ blocks: Block[] } | null>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== allowedOrigin) return
      const data = e.data as Partial<DraftMessage> | null
      if (!data || typeof data !== "object") return
      if (data.type === "preview:draft" && data.version === 1) {
        const page = data.payload?.page
        if (page && Array.isArray(page.blocks)) {
          setDraft({ blocks: page.blocks })
        }
      }
    }

    window.addEventListener("message", onMessage)

    // Send ready handshake to parent.
    if (window.parent !== window) {
      window.parent.postMessage({ type: "preview:ready", version: 1 }, allowedOrigin)
    }

    // Heartbeat every 30s.
    const heartbeat = setInterval(() => {
      if (window.parent !== window) {
        window.parent.postMessage(
          { type: "preview:heartbeat", version: 1, ts: Date.now() },
          allowedOrigin,
        )
      }
    }, 30000)

    return () => {
      window.removeEventListener("message", onMessage)
      clearInterval(heartbeat)
    }
  }, [allowedOrigin])

  if (!draft) {
    // Skeleton before first draft arrives. Empty rather than spinner —
    // the admin's loading overlay covers the iframe area until ready.
    return null
  }

  // Lazy import to keep the initial bundle small. The Blocks component is
  // an Astro component, but we render it here as a React tree by importing
  // the same .tsx renderers it uses. The cleaner path is to render via a
  // wrapper PreactBlocks component that mirrors Blocks.astro's switch.
  // For simplicity in 3c, we render a minimal switch inline.

  return <PreactBlocks blocks={draft.blocks} cmsOrigin={cmsOrigin} />
}

// PreactBlocks: Preact-side mirror of Blocks.astro. Used only inside
// the preview island; production tenant pages use Blocks.astro directly.
function PreactBlocks({ blocks, cmsOrigin }: { blocks: Block[]; cmsOrigin: string }) {
  const resolveMedia = (id: number | string | null | undefined) =>
    id == null ? null : `${cmsOrigin}/api/media/${id}/file`

  return (
    <>
      {blocks.map((block, i) => {
        try {
          return <PreactBlock key={i} block={block} resolveMedia={resolveMedia} />
        } catch (err) {
          console.warn(`[preview] block render failed:`, err)
          return null
        }
      })}
    </>
  )
}

function PreactBlock({
  block,
  resolveMedia,
}: {
  block: Block
  resolveMedia: (id: number | string | null | undefined) => string | null
}) {
  // Dynamic imports so we don't pull every renderer into the initial chunk
  // until needed. The user interacts with the form and the iframe lazily
  // pulls block code as drafts arrive. (For MVP we eagerly import; profile
  // bundle size in the 3c reviewer pass and split if >100 KB.)
  if (block.blockType === "hero") {
    const { default: Hero } = require("../cms/Hero")
    return (
      <Hero
        eyebrow={block.eyebrow}
        headline={block.headline}
        subheadline={block.subheadline}
        cta={block.cta}
        imageUrl={resolveMedia(block.image)}
      />
    )
  }
  if (block.blockType === "richText") {
    const { default: RichText } = require("../cms/RichText")
    return <RichText body={block.body} />
  }
  if (block.blockType === "cta") {
    const { default: CTA } = require("../cms/CTA")
    return (
      <CTA
        headline={block.headline}
        description={block.description}
        primary={block.primary}
        secondary={block.secondary}
      />
    )
  }
  if (block.blockType === "featureList") {
    const { default: FeatureList } = require("../cms/FeatureList")
    return (
      <FeatureList
        title={block.title}
        intro={block.intro}
        features={block.features}
      />
    )
  }
  if (block.blockType === "testimonials") {
    const { default: Testimonials } = require("../cms/Testimonials")
    const items = block.items.map((it) => ({
      ...it,
      avatarUrl: resolveMedia(it.avatar),
    }))
    return <Testimonials title={block.title} items={items} />
  }
  if (block.blockType === "faq") {
    const { default: FAQ } = require("../cms/FAQ")
    return <FAQ title={block.title} items={block.items} />
  }
  if (block.blockType === "contactSection") {
    const { default: ContactSection } = require("../cms/ContactSection")
    return (
      <ContactSection
        title={block.title}
        description={block.description}
        formName={block.formName}
        fields={block.fields}
      />
    )
  }
  return null
}
```

NOTE: the `require` calls above are placeholders for static imports that get hoisted at build time. Vite/Astro's bundler statically resolves them. Replace with normal `import` statements at the top of the file before commit.

- [ ] **Step 2: Replace `require` with static imports**

Edit the file to move all `require` calls to top-level `import` statements:

```tsx
import { useEffect, useState } from "preact/hooks"
import type { Block } from "../../lib/types"
import Hero from "../cms/Hero"
import RichText from "../cms/RichText"
import CTA from "../cms/CTA"
import FeatureList from "../cms/FeatureList"
import Testimonials from "../cms/Testimonials"
import FAQ from "../cms/FAQ"
import ContactSection from "../cms/ContactSection"

// ... (rest of the file body unchanged, but each `const { default: X } = require(...)` line removed)
```

The `PreactBlock` function then directly references the imported components.

- [ ] **Step 3: Astro check**

```bash
pnpm astro check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/preview/PreviewIsland.tsx
git commit -m "feat(preview): Preact island for postMessage-driven draft hydration"
```

### Task 3c.4: `__preview.astro` route

**Files:**
- Create: `sitegen-template/src/pages/__preview.astro`

- [ ] **Step 1: Create the route**

```astro
---
import PreviewLayout from "../layouts/PreviewLayout.astro"
import PreviewIsland from "../components/preview/PreviewIsland.tsx"
import { verifyPreviewToken } from "../lib/preview/verify"

// Read at request time. import.meta.env values come from .env / runtime env.
const token = Astro.url.searchParams.get("t")
const secret = import.meta.env.PREVIEW_HMAC_SECRET
const claims = verifyPreviewToken(token, secret)

if (!claims) {
  return new Response("Unauthorized", { status: 401 })
}

const allowedOrigin = import.meta.env.PUBLIC_ADMIN_ORIGIN ?? "https://admin.siteinabox.nl"
const cmsOrigin = allowedOrigin  // CMS and admin share the same origin
---

<PreviewLayout>
  <PreviewIsland client:load allowedOrigin={allowedOrigin} cmsOrigin={cmsOrigin} />
</PreviewLayout>
```

- [ ] **Step 2: Build to confirm**

```bash
pnpm build
```

Expected: build exits 0. The `__preview` page is included in the static build (it's a route file).

- [ ] **Step 3: Smoke test the route**

This requires a tenant deployment to actually run, which we don't have. Defer functional smoke to 3d when admin can drive it. For now: confirm the route file is well-formed by inspection.

- [ ] **Step 4: Commit**

```bash
git add src/pages/__preview.astro
git commit -m "feat(preview): /__preview route with HMAC gate + island shell"
```

### Task 3c.5: Push + reviewer + merge

- [ ] **Step 1: Push**

```bash
git push origin wave-3c-preview-route
```

- [ ] **Step 2: Dispatch reviewer**

Brief: focus on HMAC verify correctness, message validation, sandbox/origin discipline, postMessage protocol shape (does it match the spec). Note that this sub-wave can't be functionally tested end-to-end until 3d lands; reviewer should look for code-quality issues without expecting integration evidence.

- [ ] **Step 3: Address findings, merge**

```bash
git checkout main && git merge --no-ff wave-3c-preview-route -m "Merge wave-3c: __preview route + island shell + HMAC verify" && git push origin main && git branch -d wave-3c-preview-route
```

**3c is complete.** No live tenants to verify against; 3d's smoke test will be the first end-to-end exercise.

---

# Sub-wave 3d — Admin `<PreviewPane>` + transport + token endpoint

**Repo coverage:** `siab-payload` only.

**Goal:** When the operator toggles preview ON in the page editor, an iframe pointing at `https://<tenant>/__preview?t=<token>` mounts, hydrates, and re-renders on every form change with sub-100ms latency. Token mints automatically, refreshes on visibility/focus + timer. Viewport switcher works.

**Branch:** `wave-3d-preview-pane` on `siab-payload`.

### Task 3d.1: Create branch + add env

**Files:**
- Modify: `siab-payload/.env.example`
- Modify: `siab-payload/docker-compose.yml`

- [ ] **Step 1: Branch**

```bash
cd C:/Users/Shimmy/Desktop/env/deploy-siab-payload
git checkout main && git pull && git checkout -b wave-3d-preview-pane
```

- [ ] **Step 2: Add env vars to .env.example**

```bash
# Append to .env.example:
# Live preview HMAC secret. MUST match the value set on every tenant's
# deployed Astro site. Both sides .trim() on read; trailing whitespace
# from echo > .env will silently 401 every iframe load.
PREVIEW_HMAC_SECRET=<openssl rand -hex 32>
```

- [ ] **Step 3: Pass env to container in docker-compose.yml**

In the `siab-payload` service `environment:` block, add:

```yaml
PREVIEW_HMAC_SECRET: ${PREVIEW_HMAC_SECRET}
```

- [ ] **Step 4: Commit**

```bash
git add .env.example docker-compose.yml
git commit -m "chore(preview): document PREVIEW_HMAC_SECRET env + wire into compose"
```

### Task 3d.2: HMAC sign utility (with unit test)

**Files:**
- Create: `src/lib/preview/sign.ts`
- Create: `tests/unit/preview-sign.test.ts`

- [ ] **Step 1: Create the sign module**

```ts
// src/lib/preview/sign.ts
import "server-only"
import crypto from "node:crypto"

export type PreviewClaims = {
  tenantId: number | string
  pageId: number | string
}

export type SignedToken = {
  token: string
  exp: number  // unix seconds
}

const TTL_SECONDS = 30 * 60  // 30 minutes per spec

/**
 * Sign a preview HMAC token. Caller-supplied claims plus an `exp` baked
 * at sign time. Trim secret on read to defend against .env trailing
 * whitespace.
 */
export function signPreviewToken(
  claims: PreviewClaims,
  secret: string | undefined,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SignedToken {
  if (!secret) {
    throw new Error("signPreviewToken: PREVIEW_HMAC_SECRET is required")
  }
  const trimmedSecret = secret.trim()
  if (!trimmedSecret) {
    throw new Error("signPreviewToken: PREVIEW_HMAC_SECRET is empty after trim")
  }
  const exp = nowSeconds + TTL_SECONDS

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ ...claims, exp })).toString("base64url")
  const sig = crypto
    .createHmac("sha256", trimmedSecret)
    .update(`${header}.${payload}`)
    .digest("base64url")

  return { token: `${header}.${payload}.${sig}`, exp }
}
```

- [ ] **Step 2: Create the unit test**

```ts
// tests/unit/preview-sign.test.ts
import { describe, it, expect } from "vitest"
import { signPreviewToken } from "@/lib/preview/sign"

const SECRET = "test-secret-32-bytes-deadbeefcafe1234567890"

describe("signPreviewToken", () => {
  it("produces a 3-part token", () => {
    const { token } = signPreviewToken({ tenantId: 1, pageId: 42 }, SECRET)
    expect(token.split(".")).toHaveLength(3)
  })

  it("sets exp 30 minutes in the future", () => {
    const now = 1_700_000_000
    const { exp } = signPreviewToken({ tenantId: 1, pageId: 42 }, SECRET, now)
    expect(exp).toBe(now + 30 * 60)
  })

  it("throws when secret is missing", () => {
    expect(() => signPreviewToken({ tenantId: 1, pageId: 42 }, undefined)).toThrow()
    expect(() => signPreviewToken({ tenantId: 1, pageId: 42 }, "")).toThrow()
    expect(() => signPreviewToken({ tenantId: 1, pageId: 42 }, "   ")).toThrow()
  })

  it("encodes claims in the payload segment", () => {
    const { token } = signPreviewToken({ tenantId: 7, pageId: 99 }, SECRET, 1_700_000_000)
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf-8"))
    expect(payload.tenantId).toBe(7)
    expect(payload.pageId).toBe(99)
    expect(payload.exp).toBe(1_700_000_000 + 30 * 60)
  })

  it("supports string pageId for draft-<uuid> sentinel", () => {
    const { token } = signPreviewToken({ tenantId: 1, pageId: "draft-abc" }, SECRET)
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf-8"))
    expect(payload.pageId).toBe("draft-abc")
  })

  it("trims trailing whitespace from secret (parity with verify side)", () => {
    const a = signPreviewToken({ tenantId: 1, pageId: 42 }, SECRET, 1_700_000_000)
    const b = signPreviewToken({ tenantId: 1, pageId: 42 }, `${SECRET}\n`, 1_700_000_000)
    expect(a.token).toBe(b.token)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run tests/unit/preview-sign.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/preview/sign.ts tests/unit/preview-sign.test.ts
git commit -m "feat(preview): HMAC sign util + unit tests (CMS side)"
```

### Task 3d.3: `POST /api/preview-tokens` endpoint

**Files:**
- Create: `src/app/(payload)/api/preview-tokens/route.ts`

- [ ] **Step 1: Read the existing API patterns**

Look at `src/app/(payload)/api/[...slug]/route.ts` to see how Payload's REST routes are mounted. The `(payload)` route group is reserved for Payload's auto-mounted routes; new custom routes should go elsewhere or follow the same convention.

For our endpoint, we add it under `(payload)/api/preview-tokens/route.ts` since it's CMS-internal and uses Payload session auth.

- [ ] **Step 2: Create the route**

```ts
// src/app/(payload)/api/preview-tokens/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { signPreviewToken } from "@/lib/preview/sign"

/**
 * POST /api/preview-tokens
 *
 * Body: { tenantId: number, pageId: number | "draft-<uuid>" }
 *
 * Auth: caller must be an authenticated Payload user with read access to
 * the tenant (for super-admins, all tenants; for editors/owners, their
 * own tenant only — enforced via Payload's standard auth).
 *
 * Returns: { token: string, exp: number }
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })

  // Authenticate via Payload's session/cookie helper.
  let user: { id: number | string; role: string; tenants?: Array<{ tenant: number | string | { id: number | string } }> } | null
  try {
    const auth = await payload.auth({ headers: req.headers })
    user = auth.user as any
  } catch {
    user = null
  }
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  let body: { tenantId?: number; pageId?: number | string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }
  const { tenantId, pageId } = body
  if (tenantId == null || pageId == null) {
    return NextResponse.json({ message: "tenantId and pageId required" }, { status: 400 })
  }

  // Authorization: super-admin can preview any tenant; everyone else only
  // their own tenant.
  if (user.role !== "super-admin") {
    const userTenantIds = (user.tenants ?? []).map((t) =>
      typeof t.tenant === "object" ? t.tenant.id : t.tenant,
    )
    if (!userTenantIds.includes(tenantId)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }
  }

  const secret = process.env.PREVIEW_HMAC_SECRET
  if (!secret) {
    return NextResponse.json(
      { message: "Server misconfigured (PREVIEW_HMAC_SECRET unset)" },
      { status: 500 },
    )
  }

  try {
    const { token, exp } = signPreviewToken({ tenantId, pageId }, secret)
    return NextResponse.json({ token, exp })
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Token signing failed" },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 3: Integration test**

Create `tests/integration/preview-tokens.test.ts`. Pattern after the existing `tests/integration/orchestrator-api.test.ts`:

```ts
// tests/integration/preview-tokens.test.ts
import { describe, it, expect, beforeAll } from "vitest"
import { testTenant, testUser, loginAndGetCookie } from "../setup"
import { verifyPreviewToken } from "../../sitegen-template/src/lib/preview/verify"

describe("POST /api/preview-tokens", () => {
  beforeAll(() => {
    if (!process.env.PREVIEW_HMAC_SECRET) {
      process.env.PREVIEW_HMAC_SECRET = "test-secret-deadbeef".repeat(2)
    }
  })

  it("rejects unauthenticated requests with 401", async () => {
    const res = await fetch("http://localhost:3000/api/preview-tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: 1, pageId: 42 }),
    })
    expect(res.status).toBe(401)
  })

  it("issues a verifiable token for an authorized super-admin", async () => {
    const cookie = await loginAndGetCookie("super-admin")
    const res = await fetch("http://localhost:3000/api/preview-tokens", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ tenantId: 1, pageId: 42 }),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
    expect(typeof json.exp).toBe("number")
    const claims = verifyPreviewToken(json.token, process.env.PREVIEW_HMAC_SECRET)
    expect(claims).toEqual({ tenantId: 1, pageId: 42, exp: json.exp })
  })

  it("rejects a non-super-admin requesting a tenant they don't belong to", async () => {
    // Assumes test fixture creates an editor user belonging to tenant 1.
    const cookie = await loginAndGetCookie("editor-tenant-1")
    const res = await fetch("http://localhost:3000/api/preview-tokens", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ tenantId: 2, pageId: 1 }),
    })
    expect(res.status).toBe(403)
  })

  it("accepts string pageId for draft-<uuid>", async () => {
    const cookie = await loginAndGetCookie("super-admin")
    const res = await fetch("http://localhost:3000/api/preview-tokens", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ tenantId: 1, pageId: "draft-abc-123" }),
    })
    expect(res.status).toBe(200)
  })
})
```

NOTE: `loginAndGetCookie` may not exist in `tests/setup.ts`; if not, add a helper that creates a session via the Payload login endpoint and returns the cookie. Pattern after how `orchestrator-api.test.ts` authenticates (it uses an API key, not a session — adapt).

- [ ] **Step 4: Run tests (requires running server)**

```bash
# In one terminal:
npm run dev
# In another:
npx vitest run tests/integration/preview-tokens.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(payload\)/api/preview-tokens/route.ts tests/integration/preview-tokens.test.ts
git commit -m "feat(preview): POST /api/preview-tokens endpoint + integration tests"
```

### Task 3d.4: `useSignedPreviewToken` hook

**Files:**
- Create: `src/components/editor/useSignedPreviewToken.ts`

- [ ] **Step 1: Create the hook**

```ts
// src/components/editor/useSignedPreviewToken.ts
"use client"
import { useEffect, useRef, useState } from "react"

type State =
  | { status: "loading" }
  | { status: "ready"; token: string; exp: number }
  | { status: "error"; message: string }

/**
 * Mints a preview HMAC token from POST /api/preview-tokens, refreshes
 * before exp via setTimeout, AND on visibilitychange/focus to handle
 * background-tab setTimeout throttling.
 *
 * Returns the latest token + exp; consumers embed `?t=${token}` in the
 * iframe URL and call `forceRefresh()` on hard error.
 */
export function useSignedPreviewToken({
  tenantId,
  pageId,
}: {
  tenantId: number | string
  pageId: number | string
}) {
  const [state, setState] = useState<State>({ status: "loading" })
  const tokenRef = useRef<{ token: string; exp: number } | null>(null)

  const mint = async () => {
    try {
      const res = await fetch("/api/preview-tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, pageId }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.message ?? `mint failed: HTTP ${res.status}`)
      }
      const json = (await res.json()) as { token: string; exp: number }
      tokenRef.current = json
      setState({ status: "ready", token: json.token, exp: json.exp })
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Token mint failed",
      })
    }
  }

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    const scheduleRefresh = () => {
      const tok = tokenRef.current
      if (!tok) return
      const refreshAt = tok.exp - 60  // refresh 60s before expiry
      const delayMs = Math.max(0, (refreshAt - Math.floor(Date.now() / 1000)) * 1000)
      timer = window.setTimeout(() => {
        if (cancelled) return
        mint().then(() => !cancelled && scheduleRefresh())
      }, delayMs)
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      const tok = tokenRef.current
      if (!tok) return
      const remaining = tok.exp - Math.floor(Date.now() / 1000)
      if (remaining < 60) {
        // About to expire (or already did); refresh now.
        mint().then(() => !cancelled && scheduleRefresh())
      }
    }

    mint().then(() => {
      if (!cancelled) scheduleRefresh()
    })

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, pageId])

  return {
    state,
    forceRefresh: mint,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/useSignedPreviewToken.ts
git commit -m "feat(preview): useSignedPreviewToken hook with visibility/focus refresh"
```

### Task 3d.5: `<PreviewPane>` component + `<PreviewToolbar>`

**Files:**
- Create: `src/components/editor/PreviewToolbar.tsx`
- Create: `src/components/editor/PreviewPane.tsx`

- [ ] **Step 1: Create PreviewToolbar**

```tsx
// src/components/editor/PreviewToolbar.tsx
"use client"
import { Smartphone, Monitor, Maximize2, ExternalLink, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ViewportMode = "mobile" | "laptop" | "full"
export type PreviewStatus = "loading" | "ready" | "reconnecting" | "error"

type Props = {
  status: PreviewStatus
  errorMessage?: string
  viewport: ViewportMode
  setViewport: (m: ViewportMode) => void
  onRefresh: () => void
  onOpenInNewTab: () => void
}

export function PreviewToolbar({
  status,
  errorMessage,
  viewport,
  setViewport,
  onRefresh,
  onOpenInNewTab,
}: Props) {
  const dotClass =
    status === "ready"
      ? "bg-green-500"
      : status === "loading"
      ? "bg-amber-500 animate-pulse"
      : status === "reconnecting"
      ? "bg-amber-500 animate-pulse"
      : "bg-destructive"

  const label =
    status === "ready"
      ? "Live"
      : status === "loading"
      ? "Loading preview..."
      : status === "reconnecting"
      ? "Reconnecting..."
      : `Error${errorMessage ? `: ${errorMessage}` : ""}`

  return (
    <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("h-2 w-2 rounded-full shrink-0", dotClass)} aria-hidden />
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant={viewport === "mobile" ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => setViewport("mobile")}
          aria-label="Mobile viewport (375px)"
        >
          <Smartphone className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={viewport === "laptop" ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => setViewport("laptop")}
          aria-label="Laptop viewport (1024px)"
        >
          <Monitor className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={viewport === "full" ? "secondary" : "ghost"}
          size="icon"
          className="h-7 w-7"
          onClick={() => setViewport("full")}
          aria-label="Full viewport"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRefresh}
          aria-label="Refresh preview"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onOpenInNewTab}
          aria-label="Open preview in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create PreviewPane**

```tsx
// src/components/editor/PreviewPane.tsx
"use client"
import { useEffect, useRef, useState } from "react"
import { useWatch, type Control } from "react-hook-form"
import { useSignedPreviewToken } from "./useSignedPreviewToken"
import { PreviewToolbar, type ViewportMode, type PreviewStatus } from "./PreviewToolbar"

type Props = {
  control: Control<any>
  tenantId: number | string
  tenantOrigin: string  // e.g. "https://amicare.example.com"
  pageId: number | string
  /**
   * Optional callback used by smoke tests; emits each posted draft.
   */
  onDebugDraft?: (payload: { page: any }) => void
}

const DEBOUNCE_MS = 100
const HEARTBEAT_TIMEOUT_MS = 60_000  // 60s without heartbeat → reconnecting

export function PreviewPane({ control, tenantId, tenantOrigin, pageId, onDebugDraft }: Props) {
  const { state: tokenState, forceRefresh } = useSignedPreviewToken({ tenantId, pageId })
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<PreviewStatus>("loading")
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [viewport, setViewport] = useState<ViewportMode>("full")
  const lastHeartbeatRef = useRef<number>(0)

  // Sandbox-attr safety invariant: admin origin (where this component
  // runs) MUST differ from tenant origin. Otherwise allow-scripts +
  // allow-same-origin would let the iframe script-modify the embedder.
  const isInvalidOrigin =
    typeof window !== "undefined" && new URL(tenantOrigin).origin === window.location.origin

  // Subscribe to all form values from inside this component (NOT PageForm).
  // useWatch keeps re-renders local; PageForm and BlockEditor stay quiet.
  const draftValues = useWatch({ control })

  // postMessage listener
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const expected = new URL(tenantOrigin).origin
      if (e.origin !== expected) return
      const data = e.data as { type?: string; version?: number; message?: string } | null
      if (!data || typeof data !== "object") return
      if (data.type === "preview:ready" && data.version === 1) {
        setStatus("ready")
        setErrorMessage(undefined)
        lastHeartbeatRef.current = Date.now()
      } else if (data.type === "preview:heartbeat" && data.version === 1) {
        lastHeartbeatRef.current = Date.now()
      } else if (data.type === "preview:error" && data.version === 1) {
        // Per-block errors don't take the whole preview red; toast only.
        // (The spec calls for inline placeholders rendered by BlockErrorBoundary.)
        console.warn("[preview] block render error:", data.message)
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [tenantOrigin])

  // Watchdog: if no heartbeat for 60s after ready, mark reconnecting.
  useEffect(() => {
    if (status !== "ready") return
    const t = window.setInterval(() => {
      if (Date.now() - lastHeartbeatRef.current > HEARTBEAT_TIMEOUT_MS) {
        setStatus("reconnecting")
      }
    }, 5_000)
    return () => clearInterval(t)
  }, [status])

  // Debounced postMessage on draft change
  useEffect(() => {
    if (status !== "ready") return
    const win = iframeRef.current?.contentWindow
    if (!win) return
    const t = window.setTimeout(() => {
      const payload = { page: draftValues }
      win.postMessage(
        { type: "preview:draft", version: 1, payload },
        new URL(tenantOrigin).origin,
      )
      onDebugDraft?.(payload)
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [draftValues, status, tenantOrigin, onDebugDraft])

  // Token lifecycle → status
  useEffect(() => {
    if (tokenState.status === "loading") setStatus("loading")
    else if (tokenState.status === "error") {
      setStatus("error")
      setErrorMessage(tokenState.message)
    }
    // ready is set by preview:ready postMessage, not by token state
  }, [tokenState])

  if (isInvalidOrigin) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Preview disabled: tenant origin must differ from admin origin (sandbox-attr safety invariant).
      </div>
    )
  }

  if (tokenState.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading preview…
      </div>
    )
  }

  if (tokenState.status === "error") {
    return (
      <div className="space-y-2 p-4">
        <p className="text-sm text-destructive">Preview error: {tokenState.message}</p>
        <button
          type="button"
          className="text-sm underline"
          onClick={() => forceRefresh()}
        >
          Retry
        </button>
      </div>
    )
  }

  const { token } = tokenState
  const previewUrl = `${tenantOrigin}/__preview?t=${encodeURIComponent(token)}`
  const widths: Record<ViewportMode, string> = { mobile: "375px", laptop: "1024px", full: "100%" }

  return (
    <div className="flex h-full flex-col">
      <PreviewToolbar
        status={status}
        errorMessage={errorMessage}
        viewport={viewport}
        setViewport={setViewport}
        onRefresh={() => {
          // Manual refresh: force a fresh token + re-mount iframe.
          forceRefresh()
          if (iframeRef.current) iframeRef.current.src = previewUrl
        }}
        onOpenInNewTab={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
      />
      <div className="flex-1 overflow-auto bg-muted/30">
        <div
          className="mx-auto h-full transition-[width] duration-200"
          style={{ width: widths[viewport] }}
        >
          <iframe
            ref={iframeRef}
            src={previewUrl}
            sandbox="allow-scripts allow-same-origin allow-forms"
            className="h-full w-full border-0 bg-background"
            title="Page preview"
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/PreviewToolbar.tsx src/components/editor/PreviewPane.tsx
git commit -m "feat(preview): PreviewPane + PreviewToolbar with viewport switcher"
```

### Task 3d.6: Wire `<PreviewPane>` into `PageForm`

**Files:**
- Modify: `src/components/forms/PageForm.tsx`
- Modify: `src/components/editor/SaveStatusBar.tsx`

- [ ] **Step 1: Add toggle state + persistence**

In `PageForm.tsx`, add at the top of the component (near other useState hooks):

```tsx
const [previewMode, setPreviewMode] = useState<"hidden" | "side" | "fullscreen">(() => {
  if (typeof window === "undefined") return "hidden"
  const stored = window.localStorage.getItem("page-editor:preview-mode")
  return stored === "side" || stored === "fullscreen" ? stored : "hidden"
})
useEffect(() => {
  window.localStorage.setItem("page-editor:preview-mode", previewMode)
}, [previewMode])
```

- [ ] **Step 2: Determine `tenantOrigin`**

For now (MVP), `tenantOrigin` is derived per-tenant. We'll add a per-tenant "primaryDomain" lookup. As an MVP shortcut (since no tenants are deployed yet), accept it as a prop into `PageForm` (operator passes it in from the route layer that already has the tenant in scope), OR resolve via `/api/tenants/:id`.

In the `PageForm` props, add `tenantOrigin: string`. In the route file that mounts `PageForm`, pass it from the tenant record's `primaryDomain` (or `domain`) field.

- [ ] **Step 3: Render `<PreviewPane>` conditionally**

Below the existing form grid (or in a new column for `side` mode), add:

```tsx
{previewMode !== "hidden" && (
  <div
    className={
      previewMode === "side"
        ? "fixed inset-y-0 right-0 w-[600px] border-l bg-background z-30"
        : "fixed inset-0 bg-background z-40"
    }
  >
    <PreviewPane
      control={form.control}
      tenantId={tenantId}
      tenantOrigin={tenantOrigin}
      pageId={initial?.id ?? `draft-${draftSessionId}`}
    />
  </div>
)}
```

`draftSessionId` is a `useMemo(() => crypto.randomUUID(), [])` at component mount — used as the sentinel for new pages that don't have an `id` yet.

- [ ] **Step 4: Add toggle button to SaveStatusBar**

In `SaveStatusBar.tsx`, add an Eye icon button that cycles preview modes (hidden → side → fullscreen → hidden). Pass `previewMode` and `setPreviewMode` as new props.

```tsx
import { Eye } from "lucide-react"

// In the toolbar's Button group:
<Button
  variant="ghost"
  size="icon"
  type="button"
  onClick={cyclePreviewMode}
  aria-label={`Preview: ${previewMode}`}
  className="h-7 w-7"
>
  <Eye className="h-3.5 w-3.5" />
</Button>
```

- [ ] **Step 5: Build + typecheck**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -10
```

Expected: 0 type errors. Build is allowed to fail with the Windows symlink EPERM at the end (cosmetic).

- [ ] **Step 6: Commit**

```bash
git add src/components/forms/PageForm.tsx src/components/editor/SaveStatusBar.tsx
git commit -m "feat(preview): wire PreviewPane into PageForm with persistent mode toggle"
```

### Task 3d.7: Push + reviewer + merge + deploy

- [ ] **Step 1: Push**

```bash
git push origin wave-3d-preview-pane
```

- [ ] **Step 2: Dispatch reviewer**

Brief: focus on (a) `useWatch` localization (PageForm should NOT re-render on every keystroke), (b) cross-origin discipline (`targetOrigin` not `'*'`, `e.origin` checks), (c) sandbox-origin invariant assertion, (d) viewport switcher CSS resize, (e) heartbeat watchdog 60s timeout, (f) token refresh on visibilitychange. Verify against the spec.

- [ ] **Step 3: Address findings**

- [ ] **Step 4: Merge**

```bash
git checkout main && git merge --no-ff wave-3d-preview-pane -m "Merge wave-3d: admin PreviewPane + iframe + transport + token endpoint" && git push origin main && git branch -d wave-3d-preview-pane
```

- [ ] **Step 5: Set `PREVIEW_HMAC_SECRET` on prod CMS**

```bash
ssh prod 'cd /srv/saas/infra/stacks/siab-payload && cat .env | grep PREVIEW_HMAC_SECRET || echo "PREVIEW_HMAC_SECRET=$(openssl rand -hex 32)" >> .env'
```

(Generate a fresh secret if not present. Document it in the operator's password manager.)

- [ ] **Step 6: Wait for GHA build + deploy**

```bash
GH_TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill 2>/dev/null | grep '^password=' | cut -d= -f2) gh run list --repo Optidigi/siab-payload --limit 1 --json databaseId -q '.[0].databaseId' | xargs -I {} gh run watch {} --repo Optidigi/siab-payload --exit-status
ssh prod 'cd /srv/saas/infra/stacks/siab-payload && docker compose pull siab-payload && docker compose up -d siab-payload && until [ "$(docker inspect -f {{.State.Health.Status}} siab-payload 2>/dev/null)" = "healthy" ]; do sleep 3; done && curl -fsS https://admin.siteinabox.nl/api/health'
```

Expected: container healthy, `/api/health` returns `{"status":"ok",...}`.

**3d is complete.** End-to-end smoke test: spin up a test tenant via the orchestrator → open a Page in the admin → toggle preview side → confirm the iframe loads, hydrates, and updates as you type.

---

# Sub-wave 3e — Polish

**Repo coverage:** `siab-payload` + possibly `sitegen-template`.

**Goal:** Smooth out the rough edges that surface during 3d operator verification. Specific polish items below; cut any that don't matter after smoke testing.

**Branch:** `wave-3e-preview-polish` on whichever repos are touched.

### Task 3e.1: Scroll position preservation

The iframe scrolls independently. When the operator types in admin, the iframe's content updates but its scroll position can jump (especially on full reload or when blocks reorder). Preserve the scroll position across draft updates.

- [ ] **Step 1: Capture + restore scroll in PreviewIsland**

In `sitegen-template/src/components/preview/PreviewIsland.tsx`, before applying a new draft, capture `window.scrollY`. After the new tree commits, restore it via `window.scrollTo(0, savedY)` in a `useLayoutEffect`.

This handles content-length changes by clamping to the new max. If a block was deleted that pushed scroll past the new content's total height, the browser silently clamps.

- [ ] **Step 2: Test, commit**

### Task 3e.2: Loading copy refinement

The "Loading preview…" overlay during initial iframe load is currently bare. Add:
- A small spinner icon (lucide `Loader2`)
- A subtle backdrop with `backdrop-blur-sm`
- After 5 seconds without `preview:ready`, swap to "Still loading… check the tenant origin and HMAC secret if this persists."

Edit `PreviewPane.tsx`'s loading state.

### Task 3e.3: Error recovery edge cases

- If iframe fires a `load` event but no `preview:ready` in 10s → show a "Reconnect" button.
- If the token mint endpoint returns 403 (tenant not authorized for this user) → show "You don't have access to this tenant's preview" instead of the generic error.
- If `tenantOrigin` is malformed → show a clear error rather than crashing the URL constructor.

### Task 3e.4: Push + final reviewer + merge

Same pattern as 3d. The reviewer here is the **end-of-Wave-3 holistic review** — confirm the entire wave hangs together, not just the polish diff.

**3e is complete. Wave 3 is complete.**

---

## Self-review checklist

Run through this before declaring the plan ready:

- [ ] **Spec coverage:** Every section of `2026-05-06-live-preview-design.md` maps to one or more tasks above. Specifically:
  - Architecture (3 transports) → tasks across 3a-3d
  - Block renderers → 3a (3 of them) + 3b (4 of them)
  - Preview route → 3c
  - Admin UI → 3d
  - HMAC sign + verify → 3d.2 + 3c.2
  - Token refresh → 3d.4
  - Viewport switcher → 3d.5
  - PreviewLayout (slot-only) → 3a.2
  - BlockErrorBoundary → 3a.3
  - Site-converter agent edits → 3a.8 + 3a.9 + 3a.10
  - Acceptance criteria → all sub-waves contribute
- [ ] **No placeholders:** Every step has actual content. No "TBD", "implement later".
- [ ] **Type consistency:** Block prop types in renderers match the type union in `types.ts` (3a.10) AND match `siab-payload/src/blocks/*.ts` (verified during spec edits).
- [ ] **Frequent commits:** Each task ends in a commit. Sub-wave merges are explicit. Reviewer agent gates are documented.

---

## Followups (deliberately out of Wave 3 scope)

- Stakeholder share URLs (longer TTL, view-only)
- Theme system (CSS custom properties + theme registry)
- Preview of saved revisions
- Block-level diff highlighting
- Pixel-perfect mobile/tablet device frames (current viewport switcher is approximate width only)
- Live cursor / collaborative editing

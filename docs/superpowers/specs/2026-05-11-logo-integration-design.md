# Logo Integration Design

**Date:** 2026-05-11  
**Status:** Approved  

## Overview

Replace all placeholder branding (the yellow "S" badge, bare "SiteInABox" text strings, and the Globe icon on the login page) with the real SVG logo assets.

## Source Assets

Located at `/home/shimmy/Desktop/icons/`. Five files:

| Source file | Destination | Purpose |
|-------------|-------------|---------|
| `siteinabox_favicon.svg` | `public/logos/favicon.svg` | Browser tab icon; self-contained dark rounded background, no theme switching needed |
| `siteinabox_logo_vector_light.svg` | `public/logos/logo-light.svg` | Full logo (icon mark + wordmark), dark-coloured — for light backgrounds |
| `siteinabox_logo_vector_dark.svg` | `public/logos/logo-dark.svg` | Full logo, cream/light-coloured — for dark backgrounds |
| `siteinabox_logo_icon_vector_light.svg` | `public/logos/icon-light.svg` | Icon mark only, dark-coloured — for light backgrounds |
| `siteinabox_logo_icon_vector_dark.svg` | `public/logos/icon-dark.svg` | Icon mark only, cream/light-coloured — for dark backgrounds |

## Dark/Light Switching Strategy

The app uses `next-themes` with `attribute="class"`, so `.dark` is toggled on `<html>`. Theme switching uses Tailwind's `dark:` variant — no JS hook needed, no hydration flash risk.

For the sidebar's compound condition (expanded/collapsed × light/dark), use nested spans to avoid Tailwind specificity ambiguity:

```
<span class="group-data-[collapsible=icon]:hidden">   ← expanded only
  <img logo-light  class="dark:hidden h-7 w-auto" />
  <img logo-dark   class="hidden dark:block h-7 w-auto" />
</span>
<span class="hidden group-data-[collapsible=icon]:flex items-center">  ← collapsed only
  <img icon-light  class="dark:hidden h-6 w-6" />
  <img icon-dark   class="hidden dark:block h-6 w-6" />
</span>
```

Each `<img>` only needs one variant modifier (`dark:hidden` or `hidden dark:block`). The outer span handles the expanded/collapsed gate cleanly.

## Touch Points

### 1. `public/logos/` — new directory

Copy all five SVGs from the Desktop/icons source. No processing needed; they are production-ready.

### 2. `src/app/(frontend)/layout.tsx` — favicon

Add `icons` to the existing `metadata` object:

```ts
export const metadata: Metadata = {
  title: { default: "SiteInABox", template: "%s · SiteInABox" },
  icons: { icon: "/logos/favicon.svg" },
}
```

### 3. `src/components/layout/AppSidebar.tsx` — sidebar header

Replace the current `<Link>` children (the `<span>` badge with "S" + `<span>SiteInABox</span>`) with the nested-span pattern above. Remove `font-semibold` from the Link — the wordmark SVG carries its own typography. Remove `gap-2` since there are no longer two separate elements.

Expanded logo: `h-7 w-auto` (≈28 px tall, width scales with the ~2:1 aspect ratio of the full logo).  
Collapsed icon: `h-6 w-6` (24 px square, matching the old badge footprint).

### 4. `src/app/(frontend)/login/page.tsx` — login right panel

Replace the Globe icon + "SiteInABox" div with logo SVGs using the same dark/light CSS pattern. The tagline paragraph stays below the logo. Remove the Globe import if it is no longer used elsewhere in the file.

```tsx
<img src="/logos/logo-light.svg" alt="SiteInABox" className="w-full max-w-[260px] dark:hidden" />
<img src="/logos/logo-dark.svg"  alt="SiteInABox" className="hidden dark:block w-full max-w-[260px]" />
```

The containing div keeps `bg-primary text-primary-foreground` and the centred flex layout.

## Out of Scope

- Payload admin panel (`/admin` routes) — separate Payload config, not part of this repo's frontend.
- `sitegen-template` tenant sites — separate repo.
- OBS-23 logo/favicon upload for tenant branding — tracked in features backlog.

## Files Changed

1. `public/logos/favicon.svg` — new
2. `public/logos/logo-light.svg` — new
3. `public/logos/logo-dark.svg` — new
4. `public/logos/icon-light.svg` — new
5. `public/logos/icon-dark.svg` — new
6. `src/app/(frontend)/layout.tsx` — add `icons` to metadata
7. `src/components/layout/AppSidebar.tsx` — replace badge+text with logo SVGs
8. `src/app/(frontend)/login/page.tsx` — replace Globe+text with logo SVGs

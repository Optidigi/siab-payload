# Logo Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all placeholder branding (yellow "S" badge, bare text strings, Globe icon) with real SVG logo assets across the admin sidebar, login page, and browser favicon.

**Architecture:** Pure asset + JSX swap — no new components, no logic changes. CSS-only dark/light switching via Tailwind's `dark:` variant (`.dark` on `<html>` from next-themes). Nested spans handle the compound sidebar collapsed/expanded × light/dark condition without specificity conflicts.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, next-themes (`attribute="class"`).

---

## File Map

| File | Change |
|------|--------|
| `public/logos/favicon.svg` | New — copied from Desktop |
| `public/logos/logo-light.svg` | New — copied from Desktop |
| `public/logos/logo-dark.svg` | New — copied from Desktop |
| `public/logos/icon-light.svg` | New — copied from Desktop |
| `public/logos/icon-dark.svg` | New — copied from Desktop |
| `src/app/(frontend)/layout.tsx` | Add `icons` to `metadata` |
| `src/components/layout/AppSidebar.tsx` | Replace badge + text with nested-span logo pattern |
| `src/app/(frontend)/login/page.tsx` | Replace Globe icon + text with logo SVGs |

> **Note:** These are pure UI/asset changes — no business logic, no access control, no schema. There is nothing to unit-test. Verification is `pnpm typecheck` (catches import errors) plus visual inspection in the browser.

---

### Task 1: Copy SVG assets to public/logos/

**Files:**
- Create: `public/logos/favicon.svg`
- Create: `public/logos/logo-light.svg`
- Create: `public/logos/logo-dark.svg`
- Create: `public/logos/icon-light.svg`
- Create: `public/logos/icon-dark.svg`

- [ ] **Step 1: Create the directory and copy files**

```bash
mkdir -p public/logos
cp /home/shimmy/Desktop/icons/siteinabox_favicon.svg              public/logos/favicon.svg
cp /home/shimmy/Desktop/icons/siteinabox_logo_vector_light.svg    public/logos/logo-light.svg
cp /home/shimmy/Desktop/icons/siteinabox_logo_vector_dark.svg     public/logos/logo-dark.svg
cp /home/shimmy/Desktop/icons/siteinabox_logo_icon_vector_light.svg public/logos/icon-light.svg
cp /home/shimmy/Desktop/icons/siteinabox_logo_icon_vector_dark.svg  public/logos/icon-dark.svg
```

- [ ] **Step 2: Verify all five files landed**

```bash
ls -lh public/logos/
```

Expected — five `.svg` files, each a few KB:
```
favicon.svg
icon-dark.svg
icon-light.svg
logo-dark.svg
logo-light.svg
```

- [ ] **Step 3: Commit**

```bash
git add public/logos/
git commit -m "feat: add svg logo assets to public/logos"
```

---

### Task 2: Wire favicon into Next.js metadata

**Files:**
- Modify: `src/app/(frontend)/layout.tsx:15-16`

- [ ] **Step 1: Add `icons` to the metadata export**

Open `src/app/(frontend)/layout.tsx`. The current `metadata` object is:

```ts
export const metadata: Metadata = {
  title: { default: "SiteInABox", template: "%s · SiteInABox" }
}
```

Replace it with:

```ts
export const metadata: Metadata = {
  title: { default: "SiteInABox", template: "%s · SiteInABox" },
  icons: { icon: "/logos/favicon.svg" },
}
```

No import changes needed — `Metadata` from `"next"` already covers `icons`.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(frontend)/layout.tsx
git commit -m "feat: add svg favicon to app metadata"
```

---

### Task 3: Replace sidebar placeholder with logo SVGs

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx:61-63`

- [ ] **Step 1: Replace the Link's children**

Open `src/components/layout/AppSidebar.tsx`. The current `<SidebarHeader>` block (lines 60–65) is:

```tsx
<SidebarHeader>
  <Link href="/" className="flex items-center gap-2 px-2 py-1.5 font-semibold group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">S</span>
    <span className="group-data-[collapsible=icon]:hidden">SiteInABox</span>
  </Link>
</SidebarHeader>
```

Replace it with:

```tsx
<SidebarHeader>
  <Link href="/" className="flex items-center px-2 py-1.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
    {/* Expanded: full wordmark logo */}
    <span className="group-data-[collapsible=icon]:hidden">
      <img src="/logos/logo-light.svg" alt="SiteInABox" className="h-7 w-auto dark:hidden" />
      <img src="/logos/logo-dark.svg"  alt="SiteInABox" className="hidden dark:block h-7 w-auto" />
    </span>
    {/* Collapsed: icon mark only */}
    <span className="hidden group-data-[collapsible=icon]:flex items-center justify-center">
      <img src="/logos/icon-light.svg" alt="" className="h-6 w-6 dark:hidden" />
      <img src="/logos/icon-dark.svg"  alt="" className="hidden dark:block h-6 w-6" />
    </span>
  </Link>
</SidebarHeader>
```

Changes from the original:
- Removed `gap-2` (no sibling elements at the Link level anymore)
- Removed `font-semibold` (wordmark SVG carries its own typography)
- Removed the badge `<span>` entirely
- Removed the text `<span>SiteInABox</span>` entirely
- Added the nested-span pattern for expanded/collapsed × light/dark

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AppSidebar.tsx
git commit -m "feat: replace sidebar placeholder badge with svg logo"
```

---

### Task 4: Replace login panel placeholder with logo SVGs

**Files:**
- Modify: `src/app/(frontend)/login/page.tsx:1-3,22-37`

- [ ] **Step 1: Remove the Globe import**

The current import on line 2 is:

```tsx
import { Globe } from "lucide-react"
```

Delete that line entirely. `Globe` is used only in the media panel, which we're replacing.

- [ ] **Step 2: Replace the media panel content**

The current `media={...}` prop passed to `<Login04>` (lines 22–37) is:

```tsx
media={
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-primary text-primary-foreground p-8 text-center">
    <span
      aria-hidden
      className="flex size-16 items-center justify-center rounded-2xl bg-primary-foreground/10 ring-1 ring-primary-foreground/20"
    >
      <Globe className="size-8" />
    </span>
    <div className="space-y-1">
      <div className="text-2xl font-semibold tracking-tight">SiteInABox</div>
      <p className="text-sm text-primary-foreground/70 max-w-xs">
        Multi-tenant CMS — manage sites, pages, forms, and media in one place.
      </p>
    </div>
  </div>
}
```

Replace it with:

```tsx
media={
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-primary text-primary-foreground p-8 text-center">
    <div>
      <img src="/logos/logo-light.svg" alt="SiteInABox" className="w-full max-w-[260px] dark:hidden" />
      <img src="/logos/logo-dark.svg"  alt="SiteInABox" className="hidden dark:block w-full max-w-[260px]" />
    </div>
    <p className="text-sm text-primary-foreground/70 max-w-xs">
      Multi-tenant CMS — manage sites, pages, forms, and media in one place.
    </p>
  </div>
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/(frontend)/login/page.tsx
git commit -m "feat: replace login panel placeholder with svg logo"
```

---

### Task 5: Visual verification

- [ ] **Step 1: Start the dev server (if not already running)**

Ensure Postgres is up, then:

```bash
pnpm dev
```

- [ ] **Step 2: Check the browser tab favicon**

Open `http://localhost:3000` in a browser. The tab should show the rounded dark-background icon with the yellow SiteInABox mark — not a generic globe or blank icon.

- [ ] **Step 3: Check the sidebar — light mode, expanded**

With the sidebar expanded in light mode: the full SiteInABox wordmark (dark-coloured) should appear in the header. No yellow badge, no plain text.

- [ ] **Step 4: Check the sidebar — light mode, collapsed**

Collapse the sidebar (click the toggle). Only the icon mark (box/packages symbol, dark-coloured) should appear at the top. No badge, no text.

- [ ] **Step 5: Check the sidebar — dark mode**

Toggle to dark mode. Expanded: cream/light-coloured full wordmark. Collapsed: cream/light-coloured icon mark.

- [ ] **Step 6: Check the login page**

Navigate to `http://localhost:3000/login`. The right panel should show the full SiteInABox wordmark logo (not the Globe icon), with the tagline below it. Toggle dark mode and confirm the dark variant logo appears.

# Editor Polish Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship FE-11 (state-truthful Expand/Collapse-all toolbar), FE-12 (filled primary preview-toggle Button), FE-15 (state-aware block surface — inverted closed tabs, lighter open card), and FE-16 (radius-bug fix folded into FE-15) on `feat/editor-polish-fe11-12-15-16`. No edits to `src/components/ui/`. Registry stays drift-free.

**Architecture:** FE-11 lifts per-block open state from `BlockListItem` up to `BlockEditor` as a single source of truth, replacing the existing CustomEvent broadcast with `useMemo`-derived toolbar label. FE-15 makes the block-card outer container's bg/text/border state-aware (closed = `bg-foreground text-background`, open = `bg-card text-foreground`), with `overflow-hidden` folding in FE-16's corner-radius fix and `transition-all duration-150` smoothing the flip. FE-12 swaps a single Button variant on `SaveStatusBar`. All four changes are token-only and shadcn-registry-pure.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript · Tailwind · shadcn/ui via `@siab/*` private registry · pnpm 10.

**Spec:** `docs/superpowers/specs/2026-05-11-editor-polish-bundle-design.md`

---

## File map

| File | Why touched | Net change |
|---|---|---|
| `src/components/editor/BlockEditor.tsx` | FE-11: own `openMap`, hydrate from sessionStorage, derive toolbar label, pass props down | ~50 added lines + ~10 removed |
| `src/components/editor/BlockListItem.tsx` | FE-11: remove local state, accept controlled props · FE-15: state-aware className on outer, header, grip, type-icon, summary, chevron · FE-16: `overflow-hidden` on outer (folded into FE-15) | ~20 removed + ~15 modified |
| `src/components/editor/SaveStatusBar.tsx` | FE-12: one prop change | 1 line |
| `docs/backlog/features/README.md` | Move FE-11, FE-12, FE-15, FE-16 from Active to Closed (FE-CLOSED-17 through 20) | ~70 removed (Active entries) + 12 added (Closed entries) |

No other files touched. No new files. No tests added (presentation-layer; existing E2E covers).

---

## Task 1: FE-11 — Lift open state from BlockListItem to BlockEditor

**Files:**
- Modify: `src/components/editor/BlockEditor.tsx`
- Modify: `src/components/editor/BlockListItem.tsx`

This is the structural change. Do FE-11 first — FE-15's state-aware className needs the `open` prop that this task introduces.

- [ ] **Step 1: Add state machinery to `BlockEditor.tsx`**

In `src/components/editor/BlockEditor.tsx`, locate the block that today reads:

```tsx
  // Expand all / collapse all toggle. Broadcasts via CustomEvent so all
  // mounted BlockListItems can respond without prop-drilling.
  const [allCollapsed, setAllCollapsed] = useState(true)
  const onToggleAll = () => {
    const nextCollapsed = !allCollapsed
    setAllCollapsed(nextCollapsed)
    document.dispatchEvent(
      new CustomEvent("editor:set-blocks-open", { detail: { open: !nextCollapsed } })
    )
  }
```

Replace that entire block with:

```tsx
  // Per-block open state lives here (single source of truth — see FE-11).
  // sessionStorage hydration runs in the useEffect below; `setBlockOpen`
  // and `setAllOpen` both write through to storage so refresh persists.
  type OpenMap = Record<string, boolean>
  const [openMap, setOpenMap] = useState<OpenMap>({})

  // Hydrate from sessionStorage when fields change identity (mount, add, delete).
  useEffect(() => {
    setOpenMap(() => {
      const next: OpenMap = {}
      for (const [i, f] of fields.entries()) {
        const stored = sessionStorage.getItem(getSessionKey(pageId, f.id))
        if (stored !== null) next[f.id] = stored === "1"
        else next[f.id] = !isPhone && i === 0
      }
      return next
    })
  }, [pageId, isPhone, fields.length])

  const setBlockOpen = useCallback((blockFieldId: string, open: boolean) => {
    setOpenMap(prev => ({ ...prev, [blockFieldId]: open }))
    try {
      sessionStorage.setItem(getSessionKey(pageId, blockFieldId), open ? "1" : "0")
    } catch { /* storage quota: silent */ }
  }, [pageId])

  const setAllOpen = useCallback((open: boolean) => {
    setOpenMap(prev => {
      const next = { ...prev }
      for (const f of fields) {
        next[f.id] = open
        try {
          sessionStorage.setItem(getSessionKey(pageId, f.id), open ? "1" : "0")
        } catch { /* storage quota: silent */ }
      }
      return next
    })
  }, [fields, pageId])

  const allOpen = useMemo(
    () => fields.length > 0 && fields.every(f => openMap[f.id] === true),
    [fields, openMap],
  )
```

- [ ] **Step 2: Add the `getSessionKey` helper at the top of `BlockEditor.tsx`**

Add this helper near the top of the file (after imports, before the `BlockEditor` function declaration). The same helper currently lives in `BlockListItem.tsx`; we move it here as part of the lift.

```tsx
function getSessionKey(pageId: string | number, blockFieldId: string) {
  return `block-open:${pageId}:${blockFieldId}`
}
```

- [ ] **Step 3: Add imports for `useCallback`, `useEffect`, and `useMemo`**

The current `BlockEditor.tsx` imports `Fragment, useId, useState` from React. Extend that import to include the new hooks:

```tsx
// before
import { Fragment, useId, useState } from "react"
// after
import { Fragment, useCallback, useEffect, useId, useMemo, useState } from "react"
```

- [ ] **Step 4: Update the toolbar JSX in `BlockEditor.tsx`**

The current toolbar (around lines 134-140) reads:

```tsx
{fields.length > 0 && (
  <div className="flex justify-end">
    <Button variant="ghost" size="sm" type="button" onClick={onToggleAll}>
      {allCollapsed ? "Expand all" : "Collapse all"}
    </Button>
  </div>
)}
```

Replace it with:

```tsx
{fields.length > 0 && (
  <div className="flex justify-end">
    <Button variant="ghost" size="sm" type="button" onClick={() => setAllOpen(!allOpen)}>
      {allOpen ? "Collapse all" : "Expand all"}
    </Button>
  </div>
)}
```

- [ ] **Step 5: Pass new props to `BlockListItem` in the map**

Locate the `BlockListItem` render inside `fields.map(...)` (currently around lines 170-182). Add `open` and `onOpenChange` props alongside the existing ones:

```tsx
<BlockListItem
  id={f.id}
  index={i}
  total={fields.length}
  blockSlug={slug}
  blockConfig={cfg}
  tenantId={tenantId}
  onRemove={() => handleRemove(i)}
  onMove={(from, to) => move(from, to)}
  isPhone={isPhone}
  pageId={pageId}
  blockFieldId={f.id}
  open={openMap[f.id] ?? false}
  onOpenChange={(next) => setBlockOpen(f.id, next)}
/>
```

- [ ] **Step 6: Remove local state machinery from `BlockListItem.tsx`**

In `src/components/editor/BlockListItem.tsx`, find and DELETE these blocks:

1. The `getSessionKey` helper near the top of the file (currently around line 21-23):
```tsx
function getSessionKey(pageId: string | number, blockFieldId: string) {
  return `block-open:${pageId}:${blockFieldId}`
}
```

2. The `defaultOpen` + local `useState(defaultOpen)` + hydration `useEffect` + `setOpenPersist` + `editor:set-blocks-open` listener `useEffect` (currently lines 53-89):

```tsx
  // Default open: desktop only (first block only); phone starts fully collapsed.
  const defaultOpen = !isPhone && index === 0

  // SSR-safe: start with defaultOpen, hydrate from sessionStorage in effect.
  const [open, setOpen] = useState(defaultOpen)
  const [saveAsPresetOpen, setSaveAsPresetOpen] = useState(false)
  const namePrefix = `blocks.${index}`

  // Read persisted open state from sessionStorage on mount.
  useEffect(() => {
    const key = getSessionKey(pageId, blockFieldId)
    const stored = sessionStorage.getItem(key)
    if (stored !== null) {
      setOpen(stored === "1")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally only on mount — blockFieldId/pageId are stable

  // Persist open state changes to sessionStorage.
  const setOpenPersist = (next: boolean) => {
    setOpen(next)
    try {
      const key = getSessionKey(pageId, blockFieldId)
      sessionStorage.setItem(key, next ? "1" : "0")
    } catch { /* storage quota exceeded: silent */ }
  }

  // Listen for "expand all / collapse all" broadcast from BlockEditor.
  useEffect(() => {
    const onSet = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail
      if (typeof detail?.open === "boolean") setOpenPersist(detail.open)
    }
    document.addEventListener("editor:set-blocks-open", onSet)
    return () => document.removeEventListener("editor:set-blocks-open", onSet)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, blockFieldId])
```

Keep `const [saveAsPresetOpen, setSaveAsPresetOpen] = useState(false)` and `const namePrefix = \`blocks.${index}\`` — those are unrelated to FE-11 and still needed by the file's logic. Re-insert them at the same approximate position after the deletions, immediately before the next block of code (`const { control } = useFormContext()`).

- [ ] **Step 7: Add `open` and `onOpenChange` to `BlockListItem`'s prop signature**

The component's destructured props (currently at lines 25-52) need two new entries. Update both the destructure and the type definition:

```tsx
export function BlockListItem({
  id,
  index,
  total,
  blockSlug,
  blockConfig,
  tenantId,
  onRemove,
  onMove,
  isPhone,
  pageId,
  blockFieldId,
  open,
  onOpenChange,
}: {
  id: string
  index: number
  total: number
  blockSlug: string
  blockConfig: BlockWithMeta
  tenantId: number | string
  onRemove: () => void
  onMove: (from: number, to: number) => void
  isPhone: boolean
  pageId: string | number
  blockFieldId: string
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
```

The doc-comment about `tenantId` ("Forwarded to SaveAsPresetDialog…") and `blockFieldId` ("The RHF field's stable id (survives reorder)…") stay where they are inside the type literal.

- [ ] **Step 8: Update the chevron button's onClick handler in `BlockListItem.tsx`**

Find the chevron button (currently around line 222-227):

```tsx
<button
  type="button"
  onClick={() => setOpenPersist(!open)}
  className="text-muted-foreground h-11 w-11 md:h-7 md:w-7 flex items-center justify-center shrink-0"
  aria-label={open ? "Collapse block" : "Expand block"}
>
```

Change the onClick to call the new prop:

```tsx
<button
  type="button"
  onClick={() => onOpenChange(!open)}
  className="text-muted-foreground h-11 w-11 md:h-7 md:w-7 flex items-center justify-center shrink-0"
  aria-label={open ? "Collapse block" : "Expand block"}
>
```

The className stays unchanged in this step — FE-15 will edit it. Only the onClick handler changes.

- [ ] **Step 9: Remove unused `useEffect` import if no longer needed in BlockListItem.tsx**

The component still uses other `useEffect` instances (e.g. for the press timer and dragging cleanup), so the import probably stays. Run typecheck (next step) — TypeScript will flag unused imports if any.

- [ ] **Step 10: Run typecheck**

Run:
```bash
pnpm typecheck
```
Expected: PASS, exit 0.

If TypeScript reports missing `open`/`onOpenChange` somewhere (e.g. a test file or another consumer of `BlockListItem`), search the codebase: `grep -rE "<BlockListItem\b" src/` — `BlockListItem` is currently consumed only by `BlockEditor` so this should be a no-op. If anything else consumes it, add the same prop pair there.

- [ ] **Step 11: Commit**

```bash
git add src/components/editor/BlockEditor.tsx src/components/editor/BlockListItem.tsx
git commit -m "$(cat <<'EOF'
refactor(editor): lift per-block open state to BlockEditor (FE-11)

Toolbar's Expand/Collapse-all label now derives from the actual block
states via useMemo, so manual chevron toggles update the label
honestly. Per-block state lives in BlockEditor as a Record<id, boolean>
with sessionStorage hydration + write-through; BlockListItem becomes a
controlled child accepting `open` + `onOpenChange` props. The
editor:set-blocks-open CustomEvent broadcast is gone — setAllOpen flips
the state map directly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: FE-15 + FE-16 — State-aware block surface (with overflow-hidden corner fix)

**Files:**
- Modify: `src/components/editor/BlockListItem.tsx` (outer container, header, grip, type-icon, summary, chevron)

All className edits in one commit. FE-16's `overflow-hidden` is included in FE-15's outer-container className change — same line, same commit.

- [ ] **Step 1: Rewrite the outer container className**

In `src/components/editor/BlockListItem.tsx`, find the outer `<div>` (currently around lines 168-181). The current className block reads:

```tsx
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border border-foreground/15 bg-muted transition-transform",
        "data-[dragging]:ring-2 data-[dragging]:ring-primary data-[dragging]:shadow-lg data-[dragging]:bg-card/60",
        "data-[pressed]:ring-2 data-[pressed]:ring-primary/50 data-[pressed]:scale-[0.99]",
      )}
      data-dragging={isDragging || undefined}
      data-pressed={isPressed || undefined}
      onKeyDown={kbd.onKeyDown}
      aria-label={`Block ${index + 1}: ${typeof typedConfig?.labels?.singular === "string" ? typedConfig.labels.singular : blockSlug}`}
    >
```

Replace the `className={cn(...)}` block with:

```tsx
      className={cn(
        "rounded-md border overflow-hidden transition-all duration-150",
        open
          ? "bg-card text-foreground border-muted-foreground"
          : "bg-foreground text-background border-foreground",
        "data-[dragging]:ring-2 data-[dragging]:ring-primary data-[dragging]:shadow-lg",
        "data-[pressed]:ring-2 data-[pressed]:ring-primary/50 data-[pressed]:scale-[0.99]",
      )}
```

Changes summary:
- Added `overflow-hidden` → clips children to rounded radius (FE-16 fix folded in).
- Replaced `transition-transform` with `transition-all duration-150` → transitions both `transform` (dnd-kit) AND `color/bg/border` (state flip). The two `transition-*` utilities conflict; `transition-all` covers both.
- Replaced `border-foreground/15 bg-muted` with state-aware classes — closed blocks invert; open blocks use `bg-card`.
- Removed `data-[dragging]:bg-card/60` — the open/closed state already determines the bg, and the existing `ring-2 ring-primary` + `shadow-lg` signal dragging clearly enough. If smoke reveals weak dragging contrast against the inverted closed surface, add `data-[dragging]:bg-card/80` back in a follow-up.

- [ ] **Step 2: Rewrite the header strip className**

Locate the header strip `<div>` (currently around line 190). The current className reads:

```tsx
      <div className="flex items-center justify-between p-2 md:p-2 max-md:px-2 max-md:py-2 md:sticky md:top-0 md:z-[5] bg-muted rounded-t-md select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
```

Replace with (drop `bg-muted` and `rounded-t-md`):

```tsx
      <div className="flex items-center justify-between p-2 md:p-2 max-md:px-2 max-md:py-2 md:sticky md:top-0 md:z-[5] select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
```

The header now inherits its background from the outer (`bg-card` open / `bg-foreground` closed). `overflow-hidden` on the outer clips the header's natural square corners against the outer's `rounded-md`.

- [ ] **Step 3: Make the grip handle's text colour state-aware**

The grip handle is a `<button>` immediately inside the header (currently around line 192-204). Find its className:

```tsx
          <button
            type="button"
            className="cursor-grab text-muted-foreground touch-none active:cursor-grabbing h-11 w-11 md:h-7 md:w-7 flex items-center justify-center shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            aria-label="Drag to reorder block"
            {...attributes}
            {...restListeners}
            onPointerDown={combinedPointerDown}
            onPointerUp={cancelPress}
            onPointerCancel={cancelPress}
            onPointerMove={onHandlePointerMove}
          >
```

Replace the static className with `cn(...)` and a conditional:

```tsx
          <button
            type="button"
            className={cn(
              "cursor-grab touch-none active:cursor-grabbing h-11 w-11 md:h-7 md:w-7 flex items-center justify-center shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
              open ? "text-muted-foreground" : "text-background/70",
            )}
            aria-label="Drag to reorder block"
            {...attributes}
            {...restListeners}
            onPointerDown={combinedPointerDown}
            onPointerUp={cancelPress}
            onPointerCancel={cancelPress}
            onPointerMove={onHandlePointerMove}
          >
```

`cn` is already imported at the top of the file.

- [ ] **Step 4: Make the type-icon's text colour state-aware**

Find the conditional render of `typedConfig.icon` (currently around lines 205-207):

```tsx
          {typedConfig?.icon && (
            <typedConfig.icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          )}
```

Replace with:

```tsx
          {typedConfig?.icon && (
            <typedConfig.icon
              className={cn(
                "h-4 w-4 shrink-0",
                open ? "text-muted-foreground" : "text-background/70",
              )}
              aria-hidden
            />
          )}
```

- [ ] **Step 5: Make the summary span's text colour state-aware**

Find the summary span (currently around lines 214-218):

```tsx
          {summaryText && (
            <span className="text-xs text-muted-foreground truncate min-w-0">
              · {summaryText}
            </span>
          )}
```

Replace with:

```tsx
          {summaryText && (
            <span className={cn(
              "text-xs truncate min-w-0",
              open ? "text-muted-foreground" : "text-background/70",
            )}>
              · {summaryText}
            </span>
          )}
```

- [ ] **Step 6: Make the chevron button's text colour state-aware**

Find the chevron button (currently around lines 221-228, *after* the onClick swap from Task 1):

```tsx
          <button
            type="button"
            onClick={() => onOpenChange(!open)}
            className="text-muted-foreground h-11 w-11 md:h-7 md:w-7 flex items-center justify-center shrink-0"
            aria-label={open ? "Collapse block" : "Expand block"}
          >
            {open ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
          </button>
```

Replace with:

```tsx
          <button
            type="button"
            onClick={() => onOpenChange(!open)}
            className={cn(
              "h-11 w-11 md:h-7 md:w-7 flex items-center justify-center shrink-0",
              open ? "text-muted-foreground" : "text-background/70",
            )}
            aria-label={open ? "Collapse block" : "Expand block"}
          >
            {open ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
          </button>
```

- [ ] **Step 7: Leave the MoreVertical `Button variant="ghost"` unchanged**

The `Button variant="ghost"` (currently around lines 230-240) uses `currentColor` for the SVG icon. The icon will inherit colour from the parent header div, which now inherits from the outer (state-aware via `text-foreground` / `text-background`). No explicit className override needed here.

This is a smoke-test verification point — if the MoreVertical icon comes through invisible or wrong-toned during manual smoke (Task 4), promote it to a state-aware className. The spec's Risks section documents the fallback.

- [ ] **Step 8: Run typecheck**

Run:
```bash
pnpm typecheck
```
Expected: PASS, exit 0. (className changes are not type-checked; this just confirms nothing else was disturbed.)

- [ ] **Step 9: Commit**

```bash
git add src/components/editor/BlockListItem.tsx
git commit -m "$(cat <<'EOF'
feat(editor): state-aware block surface, fix collapsed-corner radius (FE-15 + FE-16)

Outer container is now bg-foreground text-background (closed, inverted
tabs) or bg-card text-foreground (open, lighter continuous card). The
header strip drops its explicit bg-muted and rounded-t-md — both
inherited from the outer now. Action icons (grip, chevron, type-icon)
and the summary span flip to text-background/70 when closed so they
stay readable on the inverted surface. Open block reads as one
continuous lighter card; the operator sees at a glance which block is
in focus.

Adds overflow-hidden on the outer (FE-16 fix — clips the header's
square bottom corners against the outer's rounded radius when
collapsed). Replaces transition-transform with transition-all
duration-150 to animate both the dnd-kit drag transform AND the
state-flip colour transitions in one rule.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: FE-12 — Eye Button filled primary

**Files:**
- Modify: `src/components/editor/SaveStatusBar.tsx:86-87`

Single prop change. No other touches.

- [ ] **Step 1: Change the Button variant**

In `src/components/editor/SaveStatusBar.tsx`, find the Button at line 86 (inside the `previewToggle` definition):

```tsx
  const previewToggle =
    setPreviewMode && previewMode !== undefined ? (
      <Button
        variant="ghost"
        size="icon"
        type="button"
        ...
```

Replace `variant="ghost"` with `variant="default"`:

```tsx
  const previewToggle =
    setPreviewMode && previewMode !== undefined ? (
      <Button
        variant="default"
        size="icon"
        type="button"
        ...
```

That is the only change in this file. The `onClick`, `aria-label`, `title`, `className`, and conditional icon children all stay identical.

- [ ] **Step 2: Run typecheck**

Run:
```bash
pnpm typecheck
```
Expected: PASS, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/SaveStatusBar.tsx
git commit -m "$(cat <<'EOF'
feat(editor): filled primary preview-toggle eye Button (FE-12)

Single variant swap on the preview-toggle Button in SaveStatusBar:
ghost → default. The Button now renders bg-primary text-primary-fg,
which inverts with theme automatically (dark box + light eye in light
mode; light box + dark eye in dark mode). The translucent bg-card/80
wrappers around the Button stay untouched — the filled primary fill
pops regardless of wrapper background.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Verification gate

All three feature commits should now be on the branch. Run registry/static gates, then a manual dev-server smoke test.

- [ ] **Step 1: Registry drift check**

Run:
```bash
pnpm registry:check
```
Expected: PASS, exit 0. Load-bearing check that we did NOT touch `src/components/ui/`. If this fails, one of the previous tasks accidentally edited a Layer 1 file.

- [ ] **Step 2: Full typecheck**

Run:
```bash
pnpm typecheck
```
Expected: PASS, exit 0.

- [ ] **Step 3: Skip lint and tests**

`pnpm lint` is non-functional (pre-existing OBS-28) and `pnpm test` has 16 pre-existing failures (OBS-29). Both are tracked in `docs/backlog/infra/README.md`. Skip with awareness.

- [ ] **Step 4: Start dev server for manual smoke**

In a side terminal (or background process), run:
```bash
pnpm dev
```
Wait for "Ready in Xs". Server should be at `http://localhost:3000`. If it crashes, abort and investigate — typecheck would have caught most issues, but runtime errors are still possible.

- [ ] **Step 5: Manual smoke — desktop, ≥4-blocks page, light theme**

Open the admin in a desktop browser. Open a page with at least 4 blocks. Verify:

1. **Block 0 is open** — lighter card surface (`bg-card`), form fields visible underneath the header.
2. **Blocks 1..N are collapsed** — solid dark "tabs" (`bg-foreground text-background`).
3. **Toolbar reads "Expand all"** (initially — since most blocks are collapsed) at the top-right of the block list.
4. **Click "Expand all"** — all blocks open, all become lighter cards. Button now reads "Collapse all".
5. **Click "Collapse all"** — all blocks become dark tabs. Button reads "Expand all".
6. **Manually expand a single block via its chevron** — only that block flips. Toolbar label flips correctly:
   - If you opened the last remaining closed block → toolbar reads "Collapse all" (all open now).
   - If you closed the only remaining open block → toolbar reads "Expand all" (all closed now).
   - **This is the FE-11 truth check.** If the toolbar doesn't update on individual toggles, the state lift is broken.
7. **Collapsed corners are rounded** — no square artifact at the bottom of any closed block (FE-16 verified).
8. **Action icons readable on closed blocks** — grip, chevron, MoreVertical, type-icon all visible against the dark background. If MoreVertical disappears, add an explicit `text-background/70` className (see spec Risks).
9. **Smooth transition** — opening a block fades surfaces smoothly (150ms transition-all). No jarring snap.
10. **Drag a block by its grip** — drag visual (ring + shadow) still distinguishable, whether dragging an open or closed block.
11. **Reload the page** — sessionStorage persistence intact. Per-block state restored.
12. **Eye button in top-right pill** — filled dark, white icon visible. Cycles between Eye / Maximize / EyeOff on click.

- [ ] **Step 6: Manual smoke — dark theme**

Switch the admin to dark theme (if there's a toggle). Verify:

1. **Closed blocks are LIGHT tabs** (inverted — `bg-foreground` becomes near-white in dark mode).
2. **Open block is the darker `bg-card` surface.**
3. **Action icons on the light tabs use a darkened tone** — readable.
4. **Eye button is now filled white with a dark icon** — same `variant="default"` inverts via the token system.

- [ ] **Step 7: Manual smoke — phone viewport**

In DevTools, switch to a phone viewport (iPhone 14, 390×844 or similar). Verify:

1. **All blocks start collapsed** (no block opens by default on phone).
2. **The trailing full-width "Add block" Button is hidden** — the floating FAB takes over.
3. **Tap a chevron** to expand a block. Reload — state persists.
4. **Toolbar reads "Expand all"** (matching the all-collapsed state).

- [ ] **Step 8: Manual smoke — empty page**

Open a page with zero blocks. Verify:

1. **Centered "Add first block" empty-state CTA unchanged.**
2. **No toolbar, no trailing button** appear (both gated on `fields.length > 0`).
3. **Clicking "Add first block"** opens the BlockTypePicker as before; the newly-added block opens on desktop (block 0 default) or stays collapsed on phone.

If any of the smoke steps fail, halt and report — do NOT continue to Task 5 with known regressions. Common likely failures and their fixes are noted in the spec's Risks section.

---

## Task 5: Close out backlog entries

Per CLAUDE.md, never describe an item as "done" without updating the backlog. Move FE-11, FE-12, FE-15, FE-16 from `## Active — frontend` to the `## Closed` section.

**Files:**
- Modify: `docs/backlog/features/README.md`

- [ ] **Step 1: Get the most recent feature commit hashes**

Run:
```bash
git log --oneline main..HEAD
```

Note the SHAs for the FE-11 commit, FE-15+16 commit, and FE-12 commit (Task 1, Task 2, Task 3 commits respectively). These will be referenced in the Closed entries below.

- [ ] **Step 2: Remove the FE-11 Active entry**

In `docs/backlog/features/README.md`, find and delete the FE-11 block entirely (Status: Active section). The entry looks like:

```markdown
### FE-11 — Toolbar "Expand all / Collapse all" label drifts from actual block states

**Status:** Active · **Layer:** frontend
**Discovered in:** Session 2026-05-11 (during FE-1 smoke test)
**File:** `src/components/editor/BlockEditor.tsx` (toolbar at lines ~136-140), `src/components/editor/BlockListItem.tsx` (per-block `open` state)

#### Description
[...full body...]

#### Suggested fix shape
[...full body...]

---
```

Remove the entire block including the trailing `---`.

- [ ] **Step 3: Remove the FE-12 Active entry**

Similarly find and delete the FE-12 block:

```markdown
### FE-12 — PreviewToolbar eye button needs higher contrast

**Status:** Active · **Layer:** frontend
[...full body...]

---
```

Remove the entire block including the trailing `---`.

- [ ] **Step 4: Remove the FE-15 Active entry**

Similarly find and delete the FE-15 block:

```markdown
### FE-15 — Block-card outline could use brand colour for more pop (revisit FE-CLOSED-15)
[...full body...]

---
```

- [ ] **Step 5: Remove the FE-16 Active entry**

Similarly find and delete the FE-16 block:

```markdown
### FE-16 — Collapsed block cards have squared bottom corners (radius bug)
[...full body...]

---
```

- [ ] **Step 6: Append four FE-CLOSED entries to the Closed section**

In the same file, find the `## Closed` section. The last existing entry is `FE-CLOSED-16` (Media empty state — shipped earlier today). Append the four new closures right after `FE-CLOSED-16`:

```markdown
### FE-CLOSED-17 — Toolbar Expand/Collapse-all label tracks actual block states
**Resolved via:** branch `feat/editor-polish-fe11-12-15-16` · Task 1 commit (FE-11) · `src/components/editor/BlockEditor.tsx`, `src/components/editor/BlockListItem.tsx`

### FE-CLOSED-18 — Preview-toggle eye Button is filled primary variant
**Resolved via:** branch `feat/editor-polish-fe11-12-15-16` · Task 3 commit (FE-12) · `src/components/editor/SaveStatusBar.tsx`

### FE-CLOSED-19 — State-aware block surface (closed inverted tabs, open lighter card)
**Resolved via:** branch `feat/editor-polish-fe11-12-15-16` · Task 2 commit (FE-15) · `src/components/editor/BlockListItem.tsx`

### FE-CLOSED-20 — Collapsed-block bottom-corner radius bug
**Resolved via:** branch `feat/editor-polish-fe11-12-15-16` · Task 2 commit (FE-16, folded into FE-15 via overflow-hidden) · `src/components/editor/BlockListItem.tsx`
```

If the actual resolving merge commit SHA is known by the time this step runs (i.e., after this branch merges to main), substitute it for the branch reference. Otherwise the branch name + Task reference is fine — it provides traceability.

- [ ] **Step 7: Update the file header's highwater mark**

The file's header (around line 10) currently reads:

```markdown
**IDs:** Frontend items use `FE-N` (current high water mark: FE-16). Full-stack/multi-repo items use `OBS-N` continuing the shared sequence (current high water mark across all backlogs: OBS-29).
```

The frontend FE-N highwater is unchanged at FE-16 since no new FE-N items are being filed in this PR (we're only closing existing ones). The OBS-N highwater is also unchanged. **Step 7 is a no-op** — confirm the header is correct, no edit needed.

- [ ] **Step 8: Commit the backlog close-out**

```bash
git add docs/backlog/features/README.md
git commit -m "$(cat <<'EOF'
docs(backlog): close FE-11, FE-12, FE-15, FE-16 — editor polish round 2

Move four shipped items from Active to Closed:
- FE-CLOSED-17 (was FE-11) — toolbar Expand/Collapse-all label is honest
- FE-CLOSED-18 (was FE-12) — preview eye Button filled primary
- FE-CLOSED-19 (was FE-15) — state-aware block surface
- FE-CLOSED-20 (was FE-16) — radius bug, folded into FE-15's edit

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Done criteria

- [x] Task 1 commit lifts state to BlockEditor; BlockListItem is controlled.
- [x] Task 2 commit makes the block surface state-aware and fixes the radius bug.
- [x] Task 3 commit changes the eye Button variant.
- [x] `pnpm registry:check` exits 0.
- [x] `pnpm typecheck` exits 0.
- [x] Manual smoke passes desktop ≥4-blocks (light + dark), phone, empty page.
- [x] Toolbar label tracks actual state when individual chevrons are clicked.
- [x] FE-11, FE-12, FE-15, FE-16 moved from Active to Closed in the backlog.
- [x] Six commits on the branch (3 feature + 1 backlog + 1 spec + 1 plan; spec/plan were committed pre-execution).

The branch is feature-complete when all done-criteria are checked. Next step is `superpowers:finishing-a-development-branch` to decide merge / PR strategy.

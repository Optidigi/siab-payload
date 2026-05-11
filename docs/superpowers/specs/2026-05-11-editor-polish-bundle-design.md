# Editor polish bundle — FE-11 + FE-12 + FE-15 + FE-16

**Date:** 2026-05-11
**Backlog items:** [FE-11, FE-12, FE-15, FE-16](../../backlog/features/README.md)
**Plan grouping rationale:** All four items live in the editor area (`src/components/editor/`). FE-11, FE-15, FE-16 all touch `BlockEditor.tsx` or `BlockListItem.tsx`. FE-12 touches `SaveStatusBar.tsx` in the same directory. One coherent "editor polish round 2" PR. FE-13 (the original brand-outline idea floated during brainstorming) is superseded by FE-15's evolved design and is **not** a separate item — see the History section.

## Scope

Four presentation/structural editor improvements:

1. **FE-11** — Toolbar "Expand all / Collapse all" label tracks actual block states (single source of truth).
2. **FE-12** — Preview-toggle eye Button uses filled primary variant for visible theme-flipping contrast.
3. **FE-15** — Block-card surface inverts per state: closed = inverted tabs (`bg-foreground text-background`), open = lighter continuous card (`bg-card text-foreground`).
4. **FE-16** — Squared bottom corners on collapsed blocks (folds into FE-15's edit via `overflow-hidden`).

**Out of scope:** new collections, schema work, migrations, new tests, new primitives, sortable/DnD changes, mobile editor reflow (FE-9), unsaved-badge redesign (FE-3).

## Registry & shadcn compatibility constraint

**Hard invariant:** zero edits to `src/components/ui/` or any other file pulled by `pnpm registry:check`. `pnpm dlx shadcn@latest add @siab/* --overwrite` must produce zero diff after this PR lands. All styling uses design-system tokens (`bg-foreground`, `text-background`, `bg-card`, `text-muted-foreground`, `border-foreground`, `border-muted-foreground`, `text-background/70`, `transition-colors`, `overflow-hidden`). No hex, no arbitrary Tailwind values (`bg-[#...]`), no inline `style` colour props. Future registry updates that change `--foreground` or `--card` token values will flow through automatically — the design is anchored to semantic tokens, not literal colours.

## Decisions

| Decision | Choice |
|---|---|
| FE-11 architecture | Lift per-block open state to `BlockEditor` as `Record<blockFieldId, boolean>` (single source of truth). `BlockListItem` becomes a controlled child. Toolbar label derives via `useMemo`. |
| FE-11 sessionStorage | Hydration + persistence move to `BlockEditor`. SessionStorage keys unchanged so returning operators keep their per-block state across the upgrade. |
| FE-12 Button variant | `variant="ghost"` → `variant="default"` on the single preview-toggle Button at `SaveStatusBar.tsx:86`. Wrappers (`bg-card/80 backdrop-blur`) untouched — the filled primary fill makes the button pop regardless of the translucent wrapper. |
| FE-15 surface treatment | State-aware: closed blocks = `bg-foreground text-background border-foreground`; open blocks = `bg-card text-foreground border-muted-foreground`. Both with `transition-colors` for smooth flips. |
| FE-15 action icon colour | State-aware: `text-muted-foreground` when open, `text-background/70` when closed. Applied to grip, chevron, and summary text. The MoreVertical `Button variant="ghost"` inherits `currentColor` from the parent header's text colour — no explicit override needed. |
| FE-15 header surface | Header strip drops its explicit `bg-muted` and `rounded-t-md` — both become unnecessary once the outer has `overflow-hidden` and a state-aware bg. |
| FE-15 form pane | Unchanged from FE-CLOSED-14 — `border-t bg-card p-3 space-y-3 rounded-b-md`. Matches the open header for visual continuity. |
| FE-16 fix mechanism | `overflow-hidden` on the outer container (folded into FE-15's className edit). Standard shadcn pattern from the Card-with-image docs. |
| Drag/pressed states | Existing `data-[dragging]:ring-2 ring-primary` and `data-[pressed]:ring-2 ring-primary/50` survive unchanged. `--primary` is high-opacity and contrasts against both surface states. |

## Files touched

| File | Changes |
|---|---|
| `src/components/editor/BlockEditor.tsx` | Add `openMap` state + hydration/persistence/setters; replace `allCollapsed` + broadcast with derived `useMemo` label and `setAllOpen` helper; pass `open` + `onOpenChange` props down to each `BlockListItem`. |
| `src/components/editor/BlockListItem.tsx` | Remove local open state + sessionStorage useEffect + broadcast listener + `setOpenPersist` + `getSessionKey`. Accept `open` + `onOpenChange` props. State-aware className on outer + header strip + action icons + summary text. Add `overflow-hidden` and `transition-colors` on outer. |
| `src/components/editor/SaveStatusBar.tsx` | Eye Button: `variant="ghost"` → `variant="default"`. One prop change. |

No other files touched. No new files, no schema, no migrations, no new tests, no edits to `src/components/ui/` or any other registry-sourced file.

## Implementation

### FE-11 — Lift open state to BlockEditor

**`src/components/editor/BlockEditor.tsx`** — at the top of the component, replace `const [allCollapsed, setAllCollapsed] = useState(true)` and the existing broadcast `onToggleAll` with this block:

```ts
type OpenMap = Record<string, boolean>

function getSessionKey(pageId: string | number, blockFieldId: string) {
  return `block-open:${pageId}:${blockFieldId}`
}

const [openMap, setOpenMap] = useState<OpenMap>({})

// Hydrate from sessionStorage when fields change identity (initial mount, add, delete)
useEffect(() => {
  setOpenMap(() => {
    const next: OpenMap = {}
    for (const [i, f] of fields.entries()) {
      const stored = sessionStorage.getItem(getSessionKey(pageId, f.id))
      if (stored !== null) next[f.id] = stored === "1"
      else next[f.id] = !isPhone && i === 0  // default: desktop block 0 open, rest closed
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

const allOpen = useMemo(() => fields.length > 0 && fields.every(f => openMap[f.id] === true), [fields, openMap])
```

Note: `isPhone` is already a prop on `BlockEditor`, so the formula `!isPhone && i === 0` reuses what `BlockListItem` had at line 54 before the lift.

Toolbar at lines 134-140:

```tsx
{fields.length > 0 && (
  <div className="flex justify-end">
    <Button variant="ghost" size="sm" type="button" onClick={() => setAllOpen(!allOpen)}>
      {allOpen ? "Collapse all" : "Expand all"}
    </Button>
  </div>
)}
```

The previous `editor:set-blocks-open` CustomEvent is **removed** — no dispatch needed because `setAllOpen` flips the state map directly.

Pass `open` + `onOpenChange` when rendering each `BlockListItem`:

```tsx
<BlockListItem
  // existing props...
  open={openMap[f.id] ?? false}
  onOpenChange={(next) => setBlockOpen(f.id, next)}
/>
```

**`src/components/editor/BlockListItem.tsx`** — remove all of the local state management:

```ts
// REMOVE these (lines 53-89 approximately):
const defaultOpen = !isPhone && index === 0
const [open, setOpen] = useState(defaultOpen)
useEffect(() => { /* sessionStorage hydration */ }, [])
const setOpenPersist = (next: boolean) => { ... }
useEffect(() => { /* editor:set-blocks-open listener */ }, [pageId, blockFieldId])
function getSessionKey(...) { ... } // also remove the top-level helper
```

Update prop signature:

```ts
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
  open,                           // NEW
  onOpenChange,                   // NEW
}: {
  // ...existing types...
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
```

Chevron click (was `setOpenPersist(!open)`):

```tsx
onClick={() => onOpenChange(!open)}
```

Conditional render unchanged in shape, but using prop:

```tsx
{open && (
  <div className="border-t bg-card p-3 space-y-3 rounded-b-md">
    ...
  </div>
)}
```

`pageId` is still a prop on `BlockListItem` because `SaveAsPresetDialog` uses it. Don't remove it.

### FE-12 — Eye Button filled primary

**`src/components/editor/SaveStatusBar.tsx:86-87`** — one prop change:

```tsx
// before
<Button
  variant="ghost"
  size="icon"

// after
<Button
  variant="default"
  size="icon"
```

Everything else in that Button block (onClick handler, aria-label, title, className, conditional icon children) stays identical. The `bg-card/80 backdrop-blur` wrappers at lines 132-140 and 281-283 stay untouched — the filled primary button is high-contrast against any background.

The Button primitive's `variant="default"` resolves to:
- Light theme: `bg-primary` = `oklch(0.205)` (near-black), `text-primary-foreground` = `oklch(0.963)` (near-white)
- Dark theme: `bg-primary` = `oklch(0.922)` (near-white), `text-primary-foreground` = `oklch(0.205)` (near-black)

Inversion is automatic via `.dark` token overrides — no theme-conditional code in this file.

### FE-15 + FE-16 — State-aware block surface (with corner fix folded in)

**`src/components/editor/BlockListItem.tsx`** outer container (currently line 172):

```tsx
// before
"rounded-md border border-foreground/15 bg-muted transition-transform",
"data-[dragging]:ring-2 data-[dragging]:ring-primary data-[dragging]:shadow-lg data-[dragging]:bg-card/60",
"data-[pressed]:ring-2 data-[pressed]:ring-primary/50 data-[pressed]:scale-[0.99]",

// after
"rounded-md border overflow-hidden transition-all duration-150",
open
  ? "bg-card text-foreground border-muted-foreground"
  : "bg-foreground text-background border-foreground",
"data-[dragging]:ring-2 data-[dragging]:ring-primary data-[dragging]:shadow-lg",
"data-[pressed]:ring-2 data-[pressed]:ring-primary/50 data-[pressed]:scale-[0.99]",
```

Notes on the diff:
- `overflow-hidden` added → FE-16's radius-clip fix.
- `transition-all duration-150` replaces the previous `transition-transform`. We need both *transform* (dnd-kit drag visual) AND *colors* (smooth state flip) to animate. Tailwind's `transition-transform` and `transition-colors` both set `transition-property` so they conflict — only the last one applied wins. `transition-all duration-150` covers both with one utility. Side-effect: shadow / opacity also transition over 150ms — acceptable polish.
- `border-foreground/15 bg-muted` removed → replaced by state-aware classes.
- `data-[dragging]:bg-card/60` removed because the open/closed state already determines the bg; the drag ring + shadow alone signal the dragging state. (Verify visually during smoke; if the dragged block needs additional contrast, add it back.)

**Header strip** (currently line 190) — drop the now-redundant `bg-muted` and `rounded-t-md`:

```tsx
// before
<div className="flex items-center justify-between p-2 md:p-2 max-md:px-2 max-md:py-2 md:sticky md:top-0 md:z-[5] bg-muted rounded-t-md select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">

// after
<div className="flex items-center justify-between p-2 md:p-2 max-md:px-2 max-md:py-2 md:sticky md:top-0 md:z-[5] select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
```

Header inherits its bg from the outer (`bg-card` when open, `bg-foreground` when closed). The `overflow-hidden` on the outer clips the header's natural square corners against the outer's rounded radius — no `rounded-t-md` needed.

**Grip handle** (currently around line 194) — state-aware text colour:

```tsx
className={cn(
  "cursor-grab touch-none active:cursor-grabbing h-11 w-11 md:h-7 md:w-7 flex items-center justify-center shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
  open ? "text-muted-foreground" : "text-background/70",
)}
```

**Type-icon container** (line 205-207) — same conditional:

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

**Block title span** (currently line 208) — colour inherits from the parent header div, so no explicit override needed once the header passes through. The existing className `font-medium truncate` is fine.

**Summary span** (currently line 215) — state-aware:

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

**Chevron button** (currently line 224) — state-aware:

```tsx
className={cn(
  "h-11 w-11 md:h-7 md:w-7 flex items-center justify-center shrink-0",
  open ? "text-muted-foreground" : "text-background/70",
)}
```

**MoreVertical `Button variant="ghost"`** (line 231) — Button's ghost variant uses `currentColor` for icon. Parent header inherits text colour from the outer (state-aware), so the icon picks up the right colour automatically. **No explicit override needed.** Confirm during smoke test that the icon is actually readable on the inverted surface — if not, add the same conditional className.

**Form pane** (line 259) — unchanged:

```tsx
<div className="border-t bg-card p-3 space-y-3 rounded-b-md">
```

When the block opens, this pane appears below the (now-also-`bg-card`) header. Visually continuous. The `border-t` 1px width inherits the project's default `--border` token colour (`oklch(0.922)` light / `oklch(1 0 0 / 10%)` dark) — a subtle internal separator between header and form fields. Note this is intentionally DIFFERENT from the outer's `border-muted-foreground` open-state border: the outer border defines the card boundary; the form pane's internal `border-t` is a softer section divider inside the card. Hierarchy reads correctly.

### Existing aria-label and other behavioural code unchanged

The outer `<div>`'s `onKeyDown={kbd.onKeyDown}`, `aria-label={...}`, and ref/style props are unaffected by these className changes. Drag-and-drop sensors, RHF integration, sortable behaviour — all unchanged.

## Edge cases

| Case | Behaviour |
|---|---|
| Returning operator with existing sessionStorage entries | `BlockEditor`'s hydration `useEffect` reads them on mount + when fields change. Per-block preferences preserved. ✅ |
| New block added via InsertSlot mid-page | `useEffect` re-runs because `fields.length` changes. New block has no sessionStorage entry → falls to default (open only if desktop + index 0, else closed). ✅ |
| Block deleted via toast Undo flow | Same code path as new-block; RHF assigns a new `.id` to the reinserted row → treated as new. Opens collapsed. ✅ |
| Drag-reorder of blocks | `fields` mutate via `move(from, to)`, but the `.id`s remain stable through reorders (dnd-kit's contract with RHF field arrays). `openMap` keys stay valid. Per-block state survives reordering. ✅ |
| Two operators in parallel (multi-tab) | SessionStorage is per-tab — no cross-tab leak. Each tab maintains its own state map. ✅ |
| Dark mode | All four tokens (`--foreground`, `--background`, `--card`, `--muted-foreground`) have `.dark` overrides in `globals.css`. Inversion comes free. ✅ |
| Phone viewport | Default still all-collapsed on phone (the formula `!isPhone && i === 0` is false for any block on phone). Trailing FAB and InsertSlots unchanged. ✅ |
| Empty page | `fields.length === 0` → no toolbar, no blocks. Centred empty-state CTA at line 152 unchanged. ✅ |
| `allOpen` derivation when no blocks | `fields.length > 0 && fields.every(...)` short-circuits to `false`. Toolbar hidden because of the existing `fields.length > 0` outer gate. ✅ |
| Smooth state transition | `transition-all duration-150` on outer covers `transform` (preserves the dnd-kit drag visual) plus colour properties (smooth open/close flip). ✅ |
| Sticky-header tone on long open blocks | Open block's `bg-card` header is sticky-on-desktop. As the operator scrolls the form, the sticky header continues showing the same `bg-card` tone. ✅ |
| Drag visual when source block is inverted (closed) vs open | Drag ring + shadow apply on top of either surface. `ring-primary` is `--primary` at full opacity — pops against both `bg-foreground` and `bg-card`. Confirmed during brainstorm. Verify during smoke. |

## Verification

CLAUDE.md gates:

1. `pnpm registry:check` — must stay green (proves Layer 1 untouched).
2. `pnpm typecheck` — must pass.
3. `pnpm lint` — skipped (pre-existing OBS-28 — not gated locally).
4. `pnpm test` — skipped (pre-existing OBS-29 — 16 failures unrelated to this surface).
5. Manual smoke at `pnpm dev`:
   - **Desktop, page with ≥4 blocks, light theme:**
     - Block 0 open, lighter card surface, integrated header + form
     - Blocks 1..N closed, dark inverted tabs
     - Toolbar reads "Expand all" or "Collapse all" matching actual state (the FE-11 truth check — toggle a chevron and verify the toolbar label updates immediately)
     - Bottom corners on closed blocks are rounded — no square artifact (FE-16)
     - Expand a block: lighter card slides in with smooth `transition-colors`
     - Drag a block by grip: ring + shadow still distinct
     - Eye button in top-right pill: filled dark, white icon visible
   - **Desktop, dark theme:**
     - Closed blocks: light inverted tabs
     - Open block: darker card surface
     - Eye button: filled white, dark icon visible
   - **Phone viewport (DevTools 390×844):**
     - All blocks collapsed
     - Toolbar reads "Expand all"
     - Trailing FAB visible; full-width primary trailing button still hidden on phone
   - **Empty page:**
     - Centered empty-state CTA unchanged
     - No trailing button, no toolbar
   - **Light↔dark theme switch (if toggle available):**
     - Surface inversion follows the theme. No flashing of wrong-coloured text.

## Risks

- **MoreVertical icon visibility on inverted surface.** The Button primitive's ghost variant uses `currentColor` for the icon. Inheritance via the parent header's text colour SHOULD work, but it depends on shadcn's Button internals. If the icon comes through too dim or wrong colour during smoke, fall back to explicit className on the Button:
  ```tsx
  className={cn(
    "max-md:size-11 size-8 shrink-0",
    open ? "text-muted-foreground" : "text-background/70",
  )}
  ```
- **Sticky-header colour shift mid-scroll.** Today the sticky header was `bg-muted`. After this PR, it'll be `bg-card` (open) or `bg-foreground` (closed). The visual change-of-tone as the operator scrolls past is intentional — the pinned strip honestly represents the block's current state. Mildly novel; flag if it feels jarring during smoke.
- **`data-[dragging]:bg-card/60` removed.** The previous design used a slightly-translucent `bg-card` for dragging visual against the muted resting blocks. The new design relies on the existing `ring-2 ring-primary` + `shadow-lg` to signal dragging. If those alone aren't enough against the inverted (closed) source block, add `data-[dragging]:bg-card/80` back as a follow-up.

## History — design evolution mid-brainstorm

This bundle's FE-15 evolved during brainstorming:

1. **Initial proposal:** swap `border-foreground/15` (the FE-CLOSED-15 baseline) for `border-primary/20` — always-on brand outline at 20% alpha. User picked B from the visual mockup.
2. **Mid-design pivot:** user asked for a theme-inverting treatment where "the toolbar + outline" is dark on light theme, light on dark theme, "thick enough to be noticeable." Revised mockup shown.
3. **Further refinement:** user accepted the inverted-header direction (Option A from the second mockup), then accepted my recommendation to apply inversion only when collapsed (Option B from the third mockup), so the open block reads as a continuous lighter card.

The shipped design is the third iteration. The earlier brand-outline ideas (FE-CLOSED-15 baseline, primary/20, foreground/60) are superseded — they remain in the closed-backlog entry for FE-CLOSED-15 as the previous state.

## Out-of-band follow-ups (NOT included in this plan)

If smoke reveals issues with:
- **Dragging contrast** against an inverted source block — add `data-[dragging]:bg-card/80` to the outer's className list as a one-line tweak in a follow-up.
- **MoreVertical icon dimness** when closed — promote the icon container Button to an explicit conditional className as documented in Risks.
- **Sticky-header tone shift** feeling jarring — consider keeping a stable `bg-card/95` sticky surface across states (would need its own brainstorm; not free of side effects).

None of these are blocking. File as new FE-N if they manifest.

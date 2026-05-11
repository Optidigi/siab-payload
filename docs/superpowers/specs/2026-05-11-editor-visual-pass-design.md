# Editor visual pass — FE-1 + FE-4 + FE-8

**Date:** 2026-05-11
**Backlog items:** [FE-1](../../backlog/features/README.md), FE-4, FE-8
**Plan grouping rationale:** All three items touch `src/components/editor/`. FE-1 and FE-8 are explicitly paired in the backlog (collapsed default reveals more summary rows, so card surface contrast matters more). FE-4 sits in the same file (`BlockEditor.tsx`) as FE-1's toolbar change. Single PR, single editor visual review pass.

## Scope

Three presentation-layer changes to the page editor:

1. **FE-1** — Blocks collapsed by default in the page editor.
2. **FE-4** — Trailing "Add block" affordance promoted to a proper registry `Button`.
3. **FE-8** — Block-card surface contrast lifted via design tokens.

**Out of scope:** new collections, schema changes, new primitives, sortable / DnD changes, mobile-specific layouts (those are FE-7 / FE-9). No edits to `src/components/ui/` (Layer 1 registry-owned).

## Decisions

| Decision | Choice |
|---|---|
| FE-1 default open state | Desktop: first block (`index === 0`) open. Phone: all collapsed. SessionStorage continues to override per-block on second visit. |
| FE-1 toolbar toggle initial state | `allCollapsed = true` so button initially reads "Expand all" (matches the state of blocks 1..N on desktop and 0..N on phone). |
| FE-4 trailing button form | Registry `Button` primitive · `variant="default"` · `size="lg"` · `w-full` · `Plus` icon. |
| FE-8 card surface direction | Variant B — `bg-muted` on outer card + header; expanded form pane lifts to `bg-card`. |
| Registry purity | Zero edits in `src/components/ui/`. Only token classes for all colours. No hex, no arbitrary Tailwind values, no inline `style` colour overrides. |

## Files touched

| File | Changes |
|---|---|
| `src/components/editor/BlockListItem.tsx` | (a) `defaultOpen` formula. (b) Three surface-token swaps (outer, header, expanded pane). (c) `data-[dragging]` background nudge. |
| `src/components/editor/BlockEditor.tsx` | (a) `allCollapsed` initial state. (b) Replace hand-rolled trailing `<button>` with `Button` primitive. |

## Implementation

### FE-1 — Collapsed by default

**`src/components/editor/BlockListItem.tsx:54`**

```ts
// before
const defaultOpen = !isPhone || index <= 2
// after
const defaultOpen = !isPhone && index === 0
```

Everything downstream is unchanged: sessionStorage hydration at `useEffect` (lines 62-69), persistence on toggle (lines 72-78), and the `editor:set-blocks-open` broadcast listener (lines 81-89) all continue working. The collapsed-state summary row (header at lines 208-218) already renders `block-type label · summary?.(values)` from the block registry — no change needed.

**`src/components/editor/BlockEditor.tsx:70`**

```ts
// before
const [allCollapsed, setAllCollapsed] = useState(false)
// after
const [allCollapsed, setAllCollapsed] = useState(true)
```

This makes the toolbar button initially read "Expand all" — which matches the reality of blocks 1..N (and on phone, blocks 0..N) starting collapsed.

### FE-4 — Trailing CTA

**`src/components/editor/BlockEditor.tsx:212-223`**

Replace the raw `<button className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 …">` with:

```tsx
<Button
  type="button"
  variant="default"
  size="lg"
  onClick={() => openPickerAt(fields.length)}
  aria-label="Add block at end"
  className={cn(
    "w-full",
    fields.length > 0 && "hidden md:flex",
    fields.length === 0 && "hidden",
  )}
>
  <Plus className="h-5 w-5" /> Add block
</Button>
```

`Button` and `Plus` are already imported in this file. `size="lg"` matches the empty-state primary button at line 154 for cross-state visual consistency. Visibility logic preserved exactly:

- Empty state (`fields.length === 0`) — hidden; empty state has its own centered CTA.
- Phone with blocks — hidden; FAB in `PageForm` covers that path.
- Desktop with blocks — visible, full-width.

### FE-8 — Surface contrast (Variant B)

**`src/components/editor/BlockListItem.tsx:172`** (outer card):

```tsx
// before
"rounded-md border bg-card transition-transform",
// after
"rounded-md border bg-muted transition-transform",
```

**`src/components/editor/BlockListItem.tsx:174-175`** (dragging state nudge — so a block being dragged still pops against the now-muted neighbours):

```tsx
// before
"data-[dragging]:ring-2 data-[dragging]:ring-primary data-[dragging]:shadow-lg data-[dragging]:bg-muted/40",
// after
"data-[dragging]:ring-2 data-[dragging]:ring-primary data-[dragging]:shadow-lg data-[dragging]:bg-card/60",
```

**`src/components/editor/BlockListItem.tsx:190`** (header strip, including its sticky-on-desktop variant):

```tsx
// before
"flex items-center justify-between p-2 md:p-2 max-md:px-2 max-md:py-2 md:sticky md:top-0 md:z-[5] bg-background rounded-t-md select-none ..."
// after
"flex items-center justify-between p-2 md:p-2 max-md:px-2 max-md:py-2 md:sticky md:top-0 md:z-[5] bg-muted rounded-t-md select-none ..."
```

**`src/components/editor/BlockListItem.tsx:259`** (expanded form pane lifts to card):

```tsx
// before
<div className="border-t p-3 space-y-3">
// after
<div className="border-t bg-card p-3 space-y-3 rounded-b-md">
```

Net effect at runtime:

- Collapsed card: muted body + muted header + border → reads as a single tile sitting clearly above the page background.
- Open card: muted header + bordered transition + card-coloured form pane below → editing pane feels "raised" above the surrounding collapsed summaries.
- Both states use only design-system tokens and inherit `.dark` overrides from `globals.css`.

## Edge cases

| Case | Behaviour |
|---|---|
| User has existing sessionStorage state | SessionStorage hydration runs in `useEffect` after first render; overrides our new default. Returning users keep their per-block choices. |
| User toggles "Expand all" then refreshes | SessionStorage now has `"1"` for every block → all blocks render open again. Already works today; unchanged. |
| Drag in progress | `data-[dragging]:bg-card/60` keeps the dragged block visually distinct against muted neighbours. |
| Mobile viewport | All blocks collapse by default. Trailing CTA is hidden (FAB takes over). |
| Empty state | Trailing CTA hidden; centered "Add first block" CTA at line 152-159 unchanged. |
| Dark mode | All four tokens have `.dark` overrides — comes free. |
| `data-pressed` long-press visual | Touches `ring-2 ring-primary/50 scale-[0.99]` — no surface colour change, unaffected by FE-8. |

## Verification

CLAUDE.md gates the completion claim. Run each before marking the work done:

1. `pnpm registry:check` — must stay green (proves Layer 1 untouched).
2. `pnpm typecheck` — must pass.
3. `pnpm lint` — must pass.
4. Manual dev-server check at `pnpm dev`:
   - Open a page with ≥4 blocks. Confirm:
     - Desktop: block 0 open, blocks 1..N collapsed; toolbar reads "Expand all".
     - Phone viewport: all blocks collapsed; trailing CTA hidden; FAB still works.
     - Collapsed cards have visible separation from the page background.
     - Opening a block: form pane visually lifts to a brighter surface than the header.
     - Drag a block: still pops visually.
     - Toggle "Expand all" → all open. Toggle "Collapse all" → all closed. Reload — sessionStorage persists.
   - Open an empty page: trailing CTA hidden; centered "Add first block" still primary.

No new automated tests required — these are presentation-only edits to a component already covered by Playwright E2E.

## Risks & non-risks

- **Non-risk: registry drift.** Zero edits in `src/components/ui/`. `pnpm registry:check --overwrite` remains a no-op for the editor changes.
- **Non-risk: data layer.** No collection edits, no migrations, no type regeneration.
- **Minor risk: collapsed-summary truncation on phone.** Header currently hides the block-type label when a summary is present on phone (line 209: `summary && "max-md:hidden"`) so phone summary rows show only the summary, not the label. After this work all blocks start collapsed on phone, making this trade-off more visible. **Decision:** leave it. Changing it would expand FE-1's scope; if it's wrong it goes to a new backlog item.
- **Minor risk: sticky header tone change.** Today the sticky-on-scroll header is `bg-background` (matches the page so it floats). After: `bg-muted` (matches the card body it belongs to). I judge the new behaviour clearer — the pinned strip honestly represents what it is — but this is the only user-visible behaviour change for already-expanded blocks.

## Out-of-band follow-ups (do NOT include in this plan)

If the new collapsed-summary row on phone reveals truncation issues, open a new FE-N. Likely candidates: FE-3 (unsaved badge), and a possible FE-11 for "phone block summary readability." Not blocking this PR.

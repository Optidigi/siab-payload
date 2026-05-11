# Editor Visual Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship FE-1 + FE-4 + FE-8 — collapsed-by-default blocks, full-width primary trailing "Add block" `Button`, and muted card surface with `bg-card` lift on expand — in `src/components/editor/` without touching `src/components/ui/`.

**Architecture:** Pure presentation-layer edits to two existing Layer 2 files (`BlockListItem.tsx`, `BlockEditor.tsx`). Uses only design-system tokens (`bg-muted`, `bg-card`, `border`) and the existing `Button` registry primitive. No new files, no schema work, no migrations, no new tests. Registry purity preserved — `pnpm registry:check` stays green.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript · Tailwind · shadcn/ui via `@siab/*` private registry · pnpm 10.

**Spec:** `docs/superpowers/specs/2026-05-11-editor-visual-pass-design.md`

---

## File map

| File | Why touched | Net change |
|---|---|---|
| `src/components/editor/BlockListItem.tsx` | FE-1 default open formula · FE-8 three surface token swaps + dragging variant nudge | 5 small edits |
| `src/components/editor/BlockEditor.tsx` | FE-1 toolbar initial label · FE-4 trailing button rewrite | 2 edits |
| `docs/backlog/features/README.md` | Move FE-1, FE-4, FE-8 from `## Active — frontend` to `## Closed` | 3 entries moved |

No other files touched. No new files created.

---

## Task 1: FE-1 — Blocks collapsed by default

**Files:**
- Modify: `src/components/editor/BlockListItem.tsx:54`
- Modify: `src/components/editor/BlockEditor.tsx:70`

- [ ] **Step 1: Change the per-block default-open formula**

In `src/components/editor/BlockListItem.tsx` replace the single line at line 54.

Old:
```ts
  const defaultOpen = !isPhone || index <= 2
```

New:
```ts
  const defaultOpen = !isPhone && index === 0
```

This makes the new behaviour: desktop → only block 0 starts open, phone → all start collapsed. SessionStorage hydration in the existing `useEffect` (lines 62-69) still overrides this on second visit, so returning users keep their per-block preferences.

- [ ] **Step 2: Flip the toolbar's initial "all collapsed" tracker**

In `src/components/editor/BlockEditor.tsx` replace the single line at line 70.

Old:
```ts
  const [allCollapsed, setAllCollapsed] = useState(false)
```

New:
```ts
  const [allCollapsed, setAllCollapsed] = useState(true)
```

This makes the toolbar button initially read **"Expand all"** (matches the new reality — blocks 1..N on desktop and 0..N on phone start collapsed). Clicking it broadcasts `editor:set-blocks-open` with `open: true` exactly as before.

- [ ] **Step 3: Run typecheck to confirm no breakage**

Run:
```bash
pnpm typecheck
```
Expected: PASS. (Type-only change to local hook calls — should be a no-op for the compiler.)

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/BlockListItem.tsx src/components/editor/BlockEditor.tsx
git commit -m "$(cat <<'EOF'
feat(editor): collapse blocks by default (FE-1)

Desktop opens only the first block; phone starts with all collapsed.
SessionStorage continues to remember per-block overrides across reloads.
Toolbar toggle initialises to "Expand all" to match the new state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: FE-8 — Block-card surface contrast

**Files:**
- Modify: `src/components/editor/BlockListItem.tsx` lines 172, 174, 190, 259

All four edits are className-only swaps to design-system tokens. No new imports, no new logic.

- [ ] **Step 1: Lift the outer card to `bg-muted`**

In `src/components/editor/BlockListItem.tsx`, find the outer container's first className line (line 172) and swap `bg-card` → `bg-muted`.

Old:
```tsx
        "rounded-md border bg-card transition-transform",
```

New:
```tsx
        "rounded-md border bg-muted transition-transform",
```

- [ ] **Step 2: Nudge the dragging-state background so a dragged block still pops**

Now that resting blocks sit on `bg-muted`, `bg-muted/40` no longer contrasts when a block is being dragged. Replace line 174.

Old:
```tsx
        "data-[dragging]:ring-2 data-[dragging]:ring-primary data-[dragging]:shadow-lg data-[dragging]:bg-muted/40",
```

New:
```tsx
        "data-[dragging]:ring-2 data-[dragging]:ring-primary data-[dragging]:shadow-lg data-[dragging]:bg-card/60",
```

- [ ] **Step 3: Match the header strip surface to the card body**

In `src/components/editor/BlockListItem.tsx` find the header div at line 190 and swap `bg-background` → `bg-muted` so the sticky-on-desktop header tone matches the card it sits on.

Old:
```tsx
      <div className="flex items-center justify-between p-2 md:p-2 max-md:px-2 max-md:py-2 md:sticky md:top-0 md:z-[5] bg-background rounded-t-md select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
```

New:
```tsx
      <div className="flex items-center justify-between p-2 md:p-2 max-md:px-2 max-md:py-2 md:sticky md:top-0 md:z-[5] bg-muted rounded-t-md select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
```

- [ ] **Step 4: Lift the expanded form pane to `bg-card`**

In `src/components/editor/BlockListItem.tsx` find the expanded-pane div at line 259 and add `bg-card` + `rounded-b-md`.

Old:
```tsx
        <div className="border-t p-3 space-y-3">
```

New:
```tsx
        <div className="border-t bg-card p-3 space-y-3 rounded-b-md">
```

- [ ] **Step 5: Run typecheck**

Run:
```bash
pnpm typecheck
```
Expected: PASS. (className strings are not type-checked; the change is purely visual. Typecheck just confirms nothing else was disturbed.)

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/BlockListItem.tsx
git commit -m "$(cat <<'EOF'
feat(editor): lift card contrast — muted surface with bg-card on expand (FE-8)

Collapsed cards sit on bg-muted with the sticky-on-desktop header strip
matching that tone. Opening a block lifts the form pane to bg-card so
editing feels raised above the surrounding summary stack. Dragging
state now uses bg-card/60 so a dragged block still pops against muted
neighbours. All changes use design-system tokens — registry untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: FE-4 — Full-width primary trailing "Add block" Button

**Files:**
- Modify: `src/components/editor/BlockEditor.tsx:212-223`

`Button` and `Plus` are already imported in this file (lines 20 and 22). No new imports.

- [ ] **Step 1: Replace the hand-rolled `<button>` with the `Button` primitive**

In `src/components/editor/BlockEditor.tsx`, replace the entire raw `<button>` block (lines 212-223) with a registry `Button`. Preserve the surrounding comment block (lines 203-211) — its visibility rationale still applies.

Old:
```tsx
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent",
          fields.length > 0 && "hidden md:inline-flex",
          fields.length === 0 && "hidden",
        )}
        onClick={() => openPickerAt(fields.length)}
        aria-label="Add block at end"
      >
        + Add block
      </button>
```

New:
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

Note the visibility logic swaps `md:inline-flex` → `md:flex` because `Button` renders as `flex`, not `inline-flex`. `size="lg"` matches the empty-state primary CTA at line 154 for cross-state consistency.

- [ ] **Step 2: Run typecheck**

Run:
```bash
pnpm typecheck
```
Expected: PASS. (`Button`'s prop shape matches what we pass; `Plus` is a `lucide-react` icon already used elsewhere in this file.)

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/BlockEditor.tsx
git commit -m "$(cat <<'EOF'
feat(editor): full-width primary Button for trailing Add block (FE-4)

Replace the bespoke <button> with the registry Button primitive (variant
default, size lg, full-width). Same visibility rules — desktop with
blocks shows it, phone with blocks defers to the floating FAB, empty
state hides in favour of the centred empty-state CTA.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Verification gate

All three feature commits should now be on the branch. Run the registry/static gates, then a manual dev-server smoke test.

- [ ] **Step 1: Registry drift check**

Run:
```bash
pnpm registry:check
```
Expected: PASS / "no drift" / exit 0. This is the load-bearing check that we did NOT touch `src/components/ui/`. If this fails the work has drifted from the registry and one of the previous tasks accidentally edited a Layer 1 file.

- [ ] **Step 2: Full typecheck**

Run:
```bash
pnpm typecheck
```
Expected: PASS, exit 0.

- [ ] **Step 3: Lint**

Run:
```bash
pnpm lint
```
Expected: PASS, exit 0.

- [ ] **Step 4: Start dev server for manual smoke test**

Run (in a side terminal, leave running for the rest of this task):
```bash
pnpm dev
```
Expected: server up at `http://localhost:3000`. If it crashes, abort — investigate before continuing.

- [ ] **Step 5: Manual smoke — desktop, page with ≥4 blocks**

Log into the admin and open a page that has 4 or more blocks. Verify, top to bottom:

1. **Block 0 is open**, the form fields visible.
2. **Blocks 1..N are collapsed**, showing only the summary row (block-type label + summary preview).
3. **Toolbar top-right reads "Expand all"** (not "Collapse all").
4. **Collapsed cards have clear visual separation** from the page background — they sit on a slightly warmer surface.
5. **The open block's form area** is visibly brighter than the header strip above it.
6. **At the bottom** there is a **full-width primary "Add block" button** with a `+` icon.
7. **Click "Expand all"** → all blocks expand, button now reads "Collapse all".
8. **Click "Collapse all"** → all blocks collapse, button reads "Expand all".
9. **Reload the page.** Block-state is preserved (sessionStorage).
10. **Drag a block** by its grip handle. The dragged block stays visible against its muted neighbours.

If any of 1-10 fails, halt and report which step.

- [ ] **Step 6: Manual smoke — phone viewport, same page**

In DevTools, switch to a phone viewport (e.g. iPhone 14, 390×844).

1. **All blocks start collapsed**, including block 0.
2. **The trailing primary "Add block" Button is hidden** — the floating FAB from `PageForm` is the only "add" affordance.
3. **Tapping a collapsed block's chevron** expands it. SessionStorage persists across reload.
4. **The InsertSlot affordances between blocks are still visible** (they have `max-md:opacity-100`).

- [ ] **Step 7: Manual smoke — empty page**

Create a new page (or open one with zero blocks).

1. **The centred "Add first block" empty state is unchanged** — primary `Button` with `LayoutTemplate` icon and `Plus`.
2. **No trailing full-width "Add block" Button appears below it** (the new visibility logic hides it when `fields.length === 0`).
3. **Clicking "Add first block"** opens the BlockTypePicker; selecting a type adds the block.

- [ ] **Step 8: Dark mode quick-check**

If the admin has a dark-mode toggle accessible, flip to dark. The card surfaces should still have visible contrast — `bg-muted` and `bg-card` both have `.dark` token overrides defined in `globals.css`. If dark mode looks flat or broken, halt.

---

## Task 5: Close out backlog entries

Per CLAUDE.md, never describe an item as "done" without updating the backlog. Move FE-1, FE-4, and FE-8 from `## Active — frontend` to the `## Closed` section of `docs/backlog/features/README.md`.

**Files:**
- Modify: `docs/backlog/features/README.md`

- [ ] **Step 1: Get the most recent commit hash for the resolving reference**

Run:
```bash
git log --oneline -1
```

Note the short SHA. The closed entries will reference this hash (or the final merge commit if/when the branch lands on `main`).

- [ ] **Step 2: Delete the three Active entries**

In `docs/backlog/features/README.md`, remove the three Active entries:

1. `### FE-1 — Blocks collapsed by default in page editor` and its body (lines ~18-30 in current file).
2. `### FE-4 — Add block button should be visually distinct` and its body (lines ~60-72).
3. `### FE-8 — Block cards — insufficient visual contrast from background` and its body (lines ~116-128).

Use the Edit tool with the exact existing content. After removal, the `## Active — frontend` section will only contain FE-2, FE-3, FE-5, FE-6, FE-7, FE-9, FE-10.

- [ ] **Step 3: Add three new entries to `## Closed`**

Append to the bottom of the `## Closed` section, just before `## Active — full-stack` (or alongside the existing `FE-CLOSED-*` entries — the section is ordered chronologically):

```markdown
### FE-CLOSED-12 — Blocks collapsed by default in page editor
**Resolved via:** plan `docs/superpowers/plans/2026-05-11-editor-visual-pass.md` · commits implementing FE-1 (closed 2026-05-11) · `src/components/editor/BlockListItem.tsx`, `src/components/editor/BlockEditor.tsx`

### FE-CLOSED-13 — Add block button visual distinction
**Resolved via:** plan `docs/superpowers/plans/2026-05-11-editor-visual-pass.md` · commits implementing FE-4 (closed 2026-05-11) · `src/components/editor/BlockEditor.tsx`

### FE-CLOSED-14 — Block cards visual contrast from background
**Resolved via:** plan `docs/superpowers/plans/2026-05-11-editor-visual-pass.md` · commits implementing FE-8 (closed 2026-05-11) · `src/components/editor/BlockListItem.tsx`
```

(If the actual resolving merge commit SHA is known by the time this step runs, substitute it for the plan-path reference.)

- [ ] **Step 4: Commit the backlog update**

```bash
git add docs/backlog/features/README.md
git commit -m "$(cat <<'EOF'
docs(backlog): close FE-1, FE-4, FE-8 — editor visual pass shipped

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Done criteria

- [x] All four verification commands exit 0: `pnpm registry:check`, `pnpm typecheck`, `pnpm lint`.
- [x] Manual smoke test passes desktop ≥4-blocks, phone, and empty-page scenarios.
- [x] Backlog entries moved from Active to Closed.
- [x] `git log` shows four commits on this branch (FE-1, FE-8, FE-4, backlog), each green.

The work is feature-complete when all done-criteria are checked. Next step after this plan is `superpowers:finishing-a-development-branch` to decide merge / PR strategy.

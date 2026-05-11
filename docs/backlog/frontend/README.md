# Frontend Backlog

Canonical source of truth for frontend / UI / UX items to review or address in future cycles.

## How this file is used

- **Each entry has a stable ID** (`FE-N`).
- **Entries categorize by status:** Active (real, deferred), Latent (not exploitable today; trigger documented), Closed (kept for lineage).
- **When something gets discovered** (during an audit, a PR review, a user report, etc.) that's frontend-shaped and not actionable in the discovering work, append it here as `FE-N`.
- **When an item is addressed**, move it to the Closed section with a reference to the resolving branch/PR/commit. Do NOT delete — lineage matters.

## Pairing

Backend items are tracked at `../backend/README.md`. Cross-references between FE-N and BE-N (or `OBS-N` for items inherited from the 2026-05 audit cycle) are encouraged where the same root issue spans both domains.

---

## Active

### FE-1 — Blocks collapsed by default in page editor

**Status:** Active
**Discovered in:** GitHub #29
**File:** `src/components/editor/BlockEditor.tsx`

#### Description
All block cards in the page editor are expanded by default. As the number of blocks on a page grows this makes the editor noisy. Blocks should render collapsed, with a click to expand.

#### Why deferred
Deferred from initial build; UX improvement, no blocking dependency.

#### Suggested fix shape
Add a per-block `collapsed` state (local, no persistence needed). Render a compact summary row when collapsed; expand on click. The collapsed row should show block type + headline/title field preview text where available.

---

### FE-2 — Delete modals — insufficient spacing between buttons and body text

**Status:** Active
**Discovered in:** GitHub #19
**File:** `src/components/confirm-dialog.tsx`, `src/components/typed-confirm-dialog.tsx`

#### Description
Delete confirmation modals have little to no spacing between the descriptive body text and the action buttons, making them feel cramped and increasing mis-click risk.

#### Why deferred
Visual polish; no blocking dependency.

#### Suggested fix shape
Increase `gap` or add `mt-*` between the dialog body and footer in the confirm dialog components. Verify all call sites render correctly after the change.

---

### FE-3 — Unsaved changes badge — poor UI

**Status:** Active
**Discovered in:** GitHub #2
**File:** `src/components/editor/SaveStatusBar.tsx`

#### Description
The unsaved changes indicator badge has an unpolished appearance that doesn't integrate well with the rest of the editor chrome.

#### Why deferred
Visual polish; not blocking.

#### Suggested fix shape
Redesign using a `Badge` or `Alert` primitive from the `@siab/*` registry. Consider a subtle animated dot indicator rather than a full badge for less visual noise.

---

### FE-4 — Add block button should be visually distinct

**Status:** Active
**Discovered in:** GitHub #13
**File:** `src/components/editor/BlockEditor.tsx`

#### Description
The button to add a new block in the block editor does not stand out enough from surrounding UI, making the primary action harder to discover.

#### Why deferred
Visual polish; not blocking.

#### Suggested fix shape
Use a dashed-border or full-width `Button` with an explicit `+` / `PlusCircle` icon. Consider a variant that makes it clear it's an insertion point rather than a generic action.

---

### FE-5 — Filter/search bar UI tweak on several list pages

**Status:** Active
**Discovered in:** GitHub #8
**File:** `src/components/tables/`, `src/components/data-table.tsx`

#### Description
The filter/search bar on list views (pages, users, media, etc.) has minor UI/UX rough edges — alignment, sizing, or interaction feel.

#### Why deferred
Requires UI review pass to identify exact issues across all list views.

#### Suggested fix shape
Audit all `DataTable` usages with filter inputs. Align to a consistent search bar pattern from the registry. Likely affects `src/app/(frontend)/(admin)/sites/[slug]/pages/page.tsx` and peers.

---

### FE-6 — Add tenant should use same modal pattern as Add user

**Status:** Active
**Discovered in:** GitHub #24
**File:** `src/app/(frontend)/(admin)/sites/new/page.tsx`

#### Description
Creating a new tenant opens a dedicated full page (`/sites/new`). The "Add user" flow uses an inline modal which feels more appropriate for a creation action. Add tenant should follow the same pattern for UX consistency.

#### Why deferred
Small refactor; current full-page flow works correctly.

#### Suggested fix shape
Convert `/sites/new` into a `Sheet` or `Dialog` modal triggered from the `/sites` list page. Reuse `TenantForm` inside the modal. The dedicated route can either be removed or kept as a redirect.

---

### FE-7 — Pages overview — DnD row reordering

**Status:** Active
**Discovered in:** GitHub #25
**File:** `src/app/(frontend)/(admin)/sites/[slug]/pages/page.tsx`

#### Description
Pages are listed in a static table. Users want to reorder them via drag-and-drop to control display order (e.g. nav menu order). Per the issue, this is UI-only — no sort order persistence required initially.

#### Why deferred
`@dnd-kit/sortable` is already installed. Wiring it is straightforward but non-trivial alongside the existing `DataTable`.

#### Suggested fix shape
Replace or augment the pages `DataTable` with a `@dnd-kit/sortable` list. The issue also suggests optionally converting rows to richer cards on desktop. If sort-order persistence is added later, a `sortOrder` field on the `Pages` collection and a PATCH endpoint will be needed (cross-reference OBS-N when that work starts).

---

### FE-8 — Block cards — insufficient visual contrast from background

**Status:** Active
**Discovered in:** GitHub #26
**File:** `src/components/editor/BlockListItem.tsx`, `src/components/editor/BlockEditor.tsx`

#### Description
Block/section cards in the page editor don't stand out clearly enough from the page background. Content inside is not named or styled intuitively enough for operators to understand the block structure at a glance.

#### Why deferred
Design iteration; not blocking.

#### Suggested fix shape
Increase border contrast (use `border-border` with a slightly elevated `bg-card` or `bg-muted` background). Add a visible block-type label and key field preview (e.g. hero headline) to each card header so blocks are identifiable when collapsed (pairs with FE-1).

---

### FE-9 — Mobile page editor — separate views per section

**Status:** Active
**Discovered in:** GitHub #23
**File:** `src/components/forms/PageForm.tsx`, `src/app/(frontend)/(admin)/sites/[slug]/pages/[id]/page.tsx`

#### Description
On mobile the page editor packs page info, all block cards, SEO settings, and delete controls into a single scrollable view — too dense. The issue asks for separate navigable views: a landing overview/card selector, a per-block detail view, and a page settings view (SEO + title/slug). Cards that are incomplete should visually communicate their state.

#### Why deferred
Significant mobile UX rework; desktop editor is already solid. Mobile-first iteration planned post-desktop stabilisation.

#### Suggested fix shape
Introduce a mobile-only tabbed or card-nav layout (using `Sheet`, `Tabs`, or a custom bottom-nav pattern) that wraps the existing form sections. The desktop layout remains unchanged. Use `useIsMobile()` (already in `src/hooks/use-mobile.ts`) to branch rendering. Incomplete-state signalling can use `Badge` or icon overlays on the nav cards.

---

### FE-10 — Multilanguage dashboard (EN + NL at minimum)

**Status:** Active
**Discovered in:** GitHub #28

#### Description
The admin dashboard is English-only. Operators need Dutch at minimum; German, French, Spanish, Russian, and Slavic languages are planned for later phases. Language should be switchable from user settings and default to browser locale.

#### Why deferred
Requires adding an i18n library and translating all UI strings. Non-trivial scope; planned as a post-core feature.

#### Suggested fix shape
Introduce `next-intl` (or equivalent) with locale files under `src/locales/`. Store user language preference in `localStorage` (sufficient for MVP; escalate to a `Users.language` field if cross-device sync is required). Wire a language switcher in the settings page. Start with EN + NL; the library makes adding further locales a translation-file-only task.

---

## Latent

*(none currently)*

---

## Closed

### FE-CLOSED-1 — Remove counter from save button
**Resolved via:** GitHub #1 (closed 2026-05-10) · `src/components/editor/PublishControls.tsx`

### FE-CLOSED-2 — Different icon when blocks list is empty
**Resolved via:** GitHub #3 (closed 2026-05-07) · `src/components/editor/BlockEditor.tsx`

### FE-CLOSED-3 — Dark mode for generated websites
**Resolved via:** GitHub #6 (closed 2026-05-08) · site-template repo

### FE-CLOSED-4 — Prettier login screen with logo (shadcn login-04)
**Resolved via:** GitHub #9 (closed 2026-05-10) · `src/app/(frontend)/login/`

### FE-CLOSED-5 — Mobile "..." button placement on list rows
**Resolved via:** GitHub #10 (closed 2026-05-10) · `src/components/data-table.tsx`

### FE-CLOSED-6 — Settings tab icons too small
**Resolved via:** GitHub #11 (closed 2026-05-10) · `src/app/(frontend)/(admin)/settings/`

### FE-CLOSED-7 — Tenant name badge awkward position in page editor
**Resolved via:** GitHub #12 (closed 2026-05-10) · `src/components/editor/PageMetaInline.tsx`

### FE-CLOSED-8 — Block type name/content not centered in block card
**Resolved via:** GitHub #14 (closed 2026-05-10) · `src/components/editor/BlockListItem.tsx`

### FE-CLOSED-9 — Activity feed horizontal overflow and scrollbar on dashboard
**Resolved via:** GitHub #15 (closed 2026-05-10) · `src/components/dashboard/ActivityFeed.tsx`

### FE-CLOSED-10 — Cards on mobile slightly too wide
**Resolved via:** GitHub #16 (closed 2026-05-10) · `src/components/ui/card.tsx` / global layout

### FE-CLOSED-11 — Media library — select all images
**Resolved via:** GitHub #18 (closed 2026-05-10) · `src/app/(frontend)/(admin)/sites/[slug]/media/`

---

## Item shape (when adding new entries)

```markdown
### FE-N — <short title>

**Status:** Active | Latent | Closed
**Discovered in:** <where: PR / audit cycle / user report / etc.>
**File:** `path:line` (if applicable)

#### Description
<what the issue is>

#### Why deferred (or not actioned in the discovering work)
<one-line reason>

#### Trigger condition (if Latent)
<what would warrant action>

#### Suggested fix shape
<the shape of the fix when it's eventually addressed>
```

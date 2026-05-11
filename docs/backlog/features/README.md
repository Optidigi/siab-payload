# Features Backlog

Product feature work — UI improvements, new functionality, and full-stack additions. Items are tagged by `**Layer:**` to indicate implementation scope.

**Layer values:**
- `frontend` — UI/UX only, no schema or API changes
- `full-stack` — meaningful work on both frontend and backend within this repo
- `multi-repo` — spans this repo AND `sitegen-template` or orchestrator

**IDs:** Frontend items use `FE-N` (current high water mark: FE-10). Full-stack/multi-repo items use `OBS-N` continuing the shared sequence (current high water mark across all backlogs: OBS-27).

Cross-reference: security findings at `../security/README.md`, infra items at `../infra/README.md`.

---

## Active — frontend

### FE-2 — Delete modals — insufficient spacing between body text and buttons

**Status:** Active · **Layer:** frontend
**Discovered in:** GitHub #19
**File:** `src/components/confirm-dialog.tsx`, `src/components/typed-confirm-dialog.tsx`

#### Description
Delete confirmation modals have little spacing between the descriptive text and action buttons, making them feel cramped and increasing mis-click risk.

#### Suggested fix shape
Increase `gap` or add `mt-*` between dialog body and footer. Verify all call sites.

---

### FE-3 — Unsaved changes badge — poor UI

**Status:** Active · **Layer:** frontend
**Discovered in:** GitHub #2
**File:** `src/components/editor/SaveStatusBar.tsx`

#### Description
The unsaved changes indicator badge doesn't integrate well with the editor chrome.

#### Suggested fix shape
Redesign using a `Badge` or `Alert` primitive. Consider a subtle animated dot indicator for less visual noise.

---

### FE-5 — Filter/search bar UI tweak on list pages

**Status:** Active · **Layer:** frontend
**Discovered in:** GitHub #8
**File:** `src/components/tables/`, `src/components/data-table.tsx`

#### Description
Filter/search bars on list views (pages, users, media) have minor alignment, sizing, or interaction rough edges.

#### Suggested fix shape
Audit all `DataTable` usages with filter inputs. Align to a consistent search bar pattern from the `@siab/*` registry.

---

### FE-6 — Add tenant should use same modal pattern as Add user

**Status:** Active · **Layer:** frontend
**Discovered in:** GitHub #24
**File:** `src/app/(frontend)/(admin)/sites/new/page.tsx`

#### Description
Creating a tenant opens a full page (`/sites/new`). The Add user flow uses an inline modal — Add tenant should match for UX consistency.

#### Suggested fix shape
Convert `/sites/new` into a `Sheet` or `Dialog` modal triggered from `/sites`. Reuse `TenantForm` inside. The dedicated route can redirect.

---

### FE-7 — Pages overview — DnD row reordering (UI-only)

**Status:** Active · **Layer:** frontend
**Discovered in:** GitHub #25
**File:** `src/app/(frontend)/(admin)/sites/[slug]/pages/page.tsx`

#### Description
Pages are listed in a static table. Users want drag-and-drop reordering. Per the issue this is UI-only — no sort-order persistence required initially. The `@siab/*` registry already includes a sortable component; `@dnd-kit/sortable` is already installed.

#### Suggested fix shape
Replace or augment the pages `DataTable` with a `@dnd-kit/sortable` list. The issue also suggests richer cards on desktop. If persistence is added later, a `sortOrder` field on `Pages` + migration will be needed (open a new OBS-N at that point).

---

### FE-9 — Mobile page editor — separate views per section

**Status:** Active · **Layer:** frontend
**Discovered in:** GitHub #23
**File:** `src/components/forms/PageForm.tsx`, `src/app/(frontend)/(admin)/sites/[slug]/pages/[id]/page.tsx`

#### Description
On mobile the editor packs page info, all blocks, SEO settings, and controls into one dense scrollable view. Needs separate navigable views: landing overview, per-block detail, page settings (SEO + title/slug). Incomplete cards should visually communicate their state.

#### Suggested fix shape
Mobile-only tabbed or card-nav layout (`Sheet`, `Tabs`, or custom bottom-nav) wrapping existing form sections. Desktop unchanged. Use `useIsMobile()` (`src/hooks/use-mobile.ts`) to branch rendering. Incomplete-state signalling via `Badge` or icon overlays.

---

### FE-11 — Toolbar "Expand all / Collapse all" label drifts from actual block states

**Status:** Active · **Layer:** frontend
**Discovered in:** Session 2026-05-11 (during FE-1 smoke test)
**File:** `src/components/editor/BlockEditor.tsx` (toolbar at lines ~136-140), `src/components/editor/BlockListItem.tsx` (per-block `open` state)

#### Description
The toolbar `allCollapsed` flag is a stateless local toggle — clicking "Expand all" sets it to `false` (button now reads "Collapse all"), but if the user then manually expands/collapses individual blocks via the chevron, the toolbar label does not update. Result: button can read "Expand all" while every block is already open, or vice-versa.

Pre-existing behaviour, exposed more visibly now that FE-1 makes the default state predominantly collapsed.

#### Suggested fix shape
Compute the toolbar label from the *actual* block states rather than a local toggle. Two approaches:
1. **Lift the per-block `open` state up** to `BlockEditor` (or a context), drop sessionStorage-per-block in favour of a single map keyed by `blockFieldId`. Then `allCollapsed = useMemo(() => Object.values(openMap).every(v => !v), [openMap])`.
2. **Listen for a "block state changed" event** from each `BlockListItem` so `BlockEditor` can recompute `allCollapsed` without owning the state. Cheaper migration but adds another CustomEvent dance.

Option 1 is cleaner long-term; option 2 is minimal-disruption. Decide during brainstorm.

---

### FE-12 — PreviewToolbar eye button needs higher contrast

**Status:** Active · **Layer:** frontend
**Discovered in:** Session 2026-05-11 (during FE-1/4/8 smoke test)
**File:** `src/components/editor/PreviewToolbar.tsx`

#### Description
The desktop preview eye-icon button is currently low-contrast against both light and dark themes — it blends into the toolbar background. Operators reported difficulty spotting it.

#### Suggested fix shape
Audit the current `Button`/`Toggle` variant used for the eye icon. Either swap to a higher-contrast registry variant (e.g. `variant="default"` filled, vs the current ghost/outline) or apply explicit token classes that flip with theme (`text-foreground` on `bg-background` will auto-invert via the `.dark` variant). No hex, no inline styles — token-only as per CLAUDE.md Layer 2 discipline.

---

### FE-10 — Multilanguage dashboard (EN + NL at minimum)

**Status:** Active · **Layer:** frontend
**Discovered in:** GitHub #28

#### Description
The admin dashboard is English-only. Dutch is required at minimum; German, French, Spanish, Russian, and Slavic planned for later phases. Switchable from settings, defaults to browser locale.

#### Suggested fix shape
Introduce `next-intl` with locale files under `src/locales/`. Store user preference in `localStorage` (escalate to `Users.language` field if cross-device sync is required later). Wire language switcher in settings. Start EN + NL; further locales are translation-file-only additions.

---

## Active — full-stack

### OBS-20 — Navigation management buried in settings (needs sidebar page)

**Status:** Active · **Layer:** full-stack
**Discovered in:** GitHub #17 (split part A)
**File:** `src/app/(frontend)/(admin)/sites/[slug]/settings/`, `src/collections/SiteSettings.ts`

#### Description
Header/footer navigation is edited under Settings → Navigation, which is unintuitive. It should be a first-class page in the sidebar. Part A of split from GH#17; part B (auto-add toggle on page create) is OBS-21.

#### Suggested fix shape
1. Add `/sites/[slug]/navigation` route with nav management UI.
2. Wire into `AppSidebar` as a first-class item.
3. Review whether nav fields in `SiteSettings` need restructuring.

---

### OBS-21 — Page create: toggle to auto-include page in header/footer nav

**Status:** Active · **Layer:** full-stack
**Discovered in:** GitHub #17 (split part B)
**File:** `src/collections/Pages.ts`, `src/components/forms/PageForm.tsx`

#### Description
When creating/editing a page, there should be separate "Include in header nav" / "Include in footer nav" toggles. Currently requires a manual Settings → Navigation trip after page creation. Part B of split from GH#17.

#### Why deferred
Depends on OBS-20 for the nav management model to be settled first.

#### Suggested fix shape
1. Add `includeInHeader: boolean` and `includeInFooter: boolean` to `Pages` collection.
2. `pnpm payload migrate:create pages-nav-toggles`.
3. Add toggle switches to `PageForm.tsx`.
4. Update projection (`src/lib/projection/`) and `sitegen-template` rendering to consume flags.

**Cross-reference:** OBS-20 — land together or in sequence.

---

### OBS-22 — Dashboard metrics — richer role-scoped data and charts

**Status:** Active · **Layer:** full-stack
**Discovered in:** GitHub #4
**File:** `src/lib/activity.ts`, `src/lib/queries/`, `src/components/dashboard/`

#### Description
Dashboard shows basic stats. Operators want richer role-scoped metrics: edits per block type, edit time-of-day heatmap, most edited pages, performance metrics. Super-admin and tenant roles must only see data scoped to their context. Issue notes suggestions are not conclusive — metric set needs agreement before building.

#### Suggested fix shape
1. Audit `src/lib/activity.ts` for current tracking; extend if block-type granularity is missing.
2. Add aggregation queries to `src/lib/queries/`.
3. Add chart components using existing `@siab/chart` primitive.
4. All queries accept `tenantId` param; super-admin passes `null` for global view.

---

### OBS-27 — Dashboard charts — dynamic and user-configurable

**Status:** Active · **Layer:** full-stack
**Discovered in:** GitHub #32 (extends GitHub #4)
**File:** `src/components/dashboard/`, `src/app/(frontend)/(admin)/dashboard/`

#### Description
The current dashboard chart (EditsChart) is static — fixed time range, fixed metric, no user control. Operators want charts they can interact with: adjustable date ranges, toggleable metrics, possibly chart-type switching. Distinct from OBS-22 which is about adding richer underlying data; this is about making the chart presentation layer configurable by the user.

#### Why deferred
Depends on OBS-22 to settle the data model and available metrics first — no point building a configurable UI over a thin data layer.

#### Suggested fix shape
1. Add date-range picker (e.g. last 7 / 30 / 90 days, custom) wired to EditsChart query.
2. Allow metric toggling if OBS-22 introduces multiple series (e.g. edits by block type).
3. Persist user preferences (selected range, visible metrics) in `localStorage` initially; escalate to a `Users.dashboardPrefs` JSON field if cross-device sync is needed.
4. Use existing `@siab/chart` primitive — no new chart library.
5. Scope: each role sees only its permitted metrics (enforced server-side per OBS-22).

**Cross-reference:** OBS-22 — build or at least design the data layer before this.

---

### OBS-23 — Settings page — full refactor (design + 2FA + GDPR + logo/favicon)

**Status:** Active · **Layer:** full-stack
**Discovered in:** GitHub #30
**File:** `src/app/(frontend)/(admin)/settings/`

#### Description
Settings page diverges from the rest of the design language. Requested additions: design alignment, profile management, plan visibility, GDPR data-request flow, 2FA toggle, maintenance banner, logo/favicon upload. Plan sub-items are deferred until a billing system exists.

#### Suggested fix shape
Tackle in sequence:
1. **Design alignment** (frontend-only) — bring tabs/layout in line with other pages.
2. **Logo/favicon** — add `logo` + `favicon` (Media relationships) to `SiteSettings`, migrate, project to `site.json`.
3. **Maintenance banner** — add `maintenanceMode: boolean` + `maintenanceBanner: text` to `SiteSettings`, project to `site.json`.
4. **2FA** — research Payload v3 TOTP support first. Apply the "Payload auth-fields default-allow" doctrine immediately on enablement (see `../security/README.md` Doctrine).
5. **GDPR data request** — new endpoint `POST /api/users/request-data` that assembles and emails a data export for the calling user.
6. **Plan** — deferred until billing system exists.

---

## Active — multi-repo

### OBS-24 — More block types + richer WYSIWYG editing

**Status:** Active · **Layer:** multi-repo (`siab-payload` + `sitegen-template`)
**Discovered in:** GitHub #27
**File:** `src/collections/BlockPresets.ts`, `src/components/editor/BlockTypePicker.tsx`, `src/components/editor/FieldRenderer.tsx`

#### Description
Current block type set is limited and names feel arbitrary (e.g. "RichText"). More block types needed with better labels, and the editing experience needs to be more WYSIWYG — especially for text/rich content. Every new block type added here must be rendered by `sitegen-template` before it is usable in production.

#### Suggested fix shape
1. Agree on block types to add (suggested: Pricing, Gallery, Team, Steps, LogoCloud at minimum).
2. Add block schemas to `BlockPresets.ts` and `Pages.ts` block union + migrate.
3. Add field renderer UI in `FieldRenderer.tsx`.
4. Add corresponding Preact renderer in `sitegen-template/src/components/cms/`.
5. Update `Blocks.astro` switch in `sitegen-template`.
6. Improve user-facing names in `BlockTypePicker.tsx` ("Hero Banner" not "hero", "Text Block" not "RichText").

**⚠️ Cross-repo:** `sitegen-template` must ship renderers before new block types are enabled for production tenants.

---

### OBS-25 — Blog posts feature

**Status:** Active · **Layer:** multi-repo (`siab-payload` + `sitegen-template`)
**Discovered in:** GitHub #7
**File:** New collection required

#### Description
Higher-tier tenants need blog post functionality: a `Posts` collection, blog-specific editor, and `sitegen-template` renderers for blog list + detail pages.

#### Why deferred
Requires product decision on data model (separate `Posts` collection vs `type: "blog"` variant on `Pages`) and tier/access gating design.

#### Suggested fix shape
1. Decision: separate `Posts` collection (cleaner for querying and access control).
2. Add `Posts` with `title`, `slug`, `publishedAt`, `author` (Users relationship), `blocks` (same union as Pages), `tenant` (multi-tenant scoped).
3. Add `Posts` to `multiTenantPlugin` collections + migrate.
4. Add list + detail views in frontend (`/sites/[slug]/posts/`).
5. Add blog list + post detail renderers in `sitegen-template`.
6. Update projection to output `posts/` to disk.

**⚠️ Cross-repo:** `sitegen-template` must ship blog renderers before this is usable in production.

---

### OBS-26 — Web analytics page (Plausible/Matomo integration)

**Status:** Active · **Layer:** multi-repo (`siab-payload` + `sitegen-template`)
**Discovered in:** GitHub #31
**File:** `src/collections/SiteSettings.ts`, new route `src/app/(frontend)/(admin)/sites/[slug]/analytics/`

#### Description
Operators want a dashboard analytics view powered by Plausible or Matomo. The tracking ID needs to be stored per tenant in `SiteSettings`, the site template needs to inject the snippet, and the admin needs a read-only analytics view pulling from the provider's API.

#### Suggested fix shape
1. Choose provider (Plausible recommended — simpler API, privacy-friendly, self-hostable).
2. Add `analyticsProvider: select(plausible | matomo | none)` + `analyticsDomain: text` to `SiteSettings`. Migrate + project to `site.json`.
3. Update `sitegen-template` to conditionally inject provider snippet when `analyticsDomain` is set.
4. Add `/sites/[slug]/analytics` route calling provider stats API (server-side, API key in env) rendering read-only charts using `@siab/chart`.
5. Scope: tenant owners/editors see only their own site's analytics.

**⚠️ Cross-repo:** `sitegen-template` must inject the analytics snippet before data is collected.

---

## Closed

### FE-CLOSED-1 — Remove counter from save button
**Resolved via:** GitHub #1 (closed 2026-05-10) · `src/components/editor/PublishControls.tsx`

### FE-CLOSED-2 — Different icon when blocks list is empty
**Resolved via:** GitHub #3 (closed 2026-05-07) · `src/components/editor/BlockEditor.tsx`

### FE-CLOSED-3 — Dark mode for generated websites
**Resolved via:** GitHub #6 (closed 2026-05-08) · `sitegen-template` repo

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

### FE-CLOSED-9 — Activity feed horizontal overflow on dashboard
**Resolved via:** GitHub #15 (closed 2026-05-10) · `src/components/dashboard/ActivityFeed.tsx`

### FE-CLOSED-10 — Cards on mobile slightly too wide
**Resolved via:** GitHub #16 (closed 2026-05-10) · layout

### FE-CLOSED-11 — Media library — select all images
**Resolved via:** GitHub #18 (closed 2026-05-10) · `src/app/(frontend)/(admin)/sites/[slug]/media/`

### FE-CLOSED-12 — Blocks collapsed by default in page editor
**Resolved via:** branch `feat/editor-visual-pass-fe1-fe4-fe8` · commit `79f301a` (FE-1) · `src/components/editor/BlockListItem.tsx`, `src/components/editor/BlockEditor.tsx`

### FE-CLOSED-13 — Add block button visual distinction
**Resolved via:** branch `feat/editor-visual-pass-fe1-fe4-fe8` · commit `bf75921` (FE-4) · `src/components/editor/BlockEditor.tsx`

### FE-CLOSED-14 — Block cards visual contrast from background
**Resolved via:** branch `feat/editor-visual-pass-fe1-fe4-fe8` · commit `fb6597c` (FE-8) · `src/components/editor/BlockListItem.tsx`

### FE-CLOSED-15 — Block-card theme-aware outline
**Resolved via:** branch `feat/editor-visual-pass-fe1-fe4-fe8` · commit `63edcb0` (FE-13, bundled mid-flight after smoke) · `src/components/editor/BlockListItem.tsx`

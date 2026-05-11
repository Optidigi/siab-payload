# Brand Color Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the SiteInABox logo color palette into the `@siab` registry theme, adding a brand yellow token and aligning existing neutral surface/text tokens to the logo's cream and near-black.

**Architecture:** All changes live in `packages/siab/registry.json` in the `Optidigi/design-systems` repo. `shadcn build` compiles that JSON into static per-component JSON files served by nginx. `pnpm registry:check --overwrite` in `siab-payload` pulls the updated tokens and regenerates `globals.css`. No component files change — every component already consumes tokens via CSS cascade.

**Tech Stack:** JSON (registry source), shadcn CLI (`shadcn build`), nginx (registry server on VPS), pnpm, Next.js dev server for visual verification.

---

## Files

- **Modify:** `packages/siab/registry.json` (in `Optidigi/design-systems`) — all token changes
- **Auto-generated (do not hand-edit):** `src/styles/globals.css` (in `siab-payload`) — rewritten by `pnpm registry:check --overwrite`

---

### Task 1: Edit token values in registry.json

**File:** `/home/shimmy/Desktop/design-systems/packages/siab/registry.json`

The three logo palette values used throughout:
- Brand yellow: `oklch(0.902 0.194 99)`
- Logo cream: `oklch(0.963 0.007 80)`
- Logo near-black: `oklch(0.214 0.004 17)`

- [ ] **Step 1: Apply all light-mode token changes**

In the `"light"` block (lines 18–55), make these replacements:

```json
"foreground": "oklch(0.214 0.004 17)",
"card-foreground": "oklch(0.214 0.004 17)",
"popover-foreground": "oklch(0.214 0.004 17)",
"primary-foreground": "oklch(0.963 0.007 80)",
"secondary": "oklch(0.963 0.007 80)",
"secondary-foreground": "oklch(0.214 0.004 17)",
"muted": "oklch(0.963 0.007 80)",
"accent": "oklch(0.963 0.007 80)",
"accent-foreground": "oklch(0.214 0.004 17)",
"ring": "oklch(0.902 0.194 99)",
"chart-4": "oklch(0.902 0.194 99)",
"sidebar-foreground": "oklch(0.214 0.004 17)",
"sidebar-primary-foreground": "oklch(0.963 0.007 80)",
"sidebar-accent-foreground": "oklch(0.214 0.004 17)"
```

Also add the two new brand tokens at the end of the `"light"` block (before the closing `}`):

```json
"brand": "oklch(0.902 0.194 99)",
"brand-foreground": "oklch(0.214 0.004 17)"
```

- [ ] **Step 2: Apply all dark-mode token changes**

In the `"dark"` block (lines 56–93), make these replacements:

```json
"foreground": "oklch(0.963 0.007 80)",
"card": "oklch(0.214 0.004 17)",
"card-foreground": "oklch(0.963 0.007 80)",
"popover-foreground": "oklch(0.963 0.007 80)",
"ring": "oklch(0.902 0.194 99)",
"chart-4": "oklch(0.902 0.194 99)",
"sidebar": "oklch(0.214 0.004 17)",
"sidebar-foreground": "oklch(0.963 0.007 80)",
"sidebar-primary": "oklch(0.902 0.194 99)",
"sidebar-primary-foreground": "oklch(0.214 0.004 17)"
```

Also add at the end of the `"dark"` block (before the closing `}`):

```json
"brand": "oklch(0.902 0.194 99)",
"brand-foreground": "oklch(0.214 0.004 17)"
```

- [ ] **Step 3: Validate JSON is well-formed**

```bash
cd /home/shimmy/Desktop/design-systems
node -e "JSON.parse(require('fs').readFileSync('packages/siab/registry.json','utf8')); console.log('valid')"
```

Expected output: `valid`

---

### Task 2: Build registry locally and verify output

- [ ] **Step 1: Run the local build**

```bash
cd /home/shimmy/Desktop/design-systems
pnpm build:siab
```

Expected: no errors, output ends with something like `✓ Built N registry items`

- [ ] **Step 2: Confirm brand token appears in built output**

```bash
grep -r "brand" /home/shimmy/Desktop/design-systems/public/r/v1/siab/ | grep "oklch" | head -5
```

Expected: lines containing `oklch(0.902 0.194 99)` in the theme JSON file.

- [ ] **Step 3: Confirm ring token updated**

```bash
grep "ring" /home/shimmy/Desktop/design-systems/public/r/v1/siab/theme.json
```

Expected: `oklch(0.902 0.194 99)` for both light and dark ring values.

- [ ] **Step 4: Commit registry changes**

```bash
cd /home/shimmy/Desktop/design-systems
git add packages/siab/registry.json
git commit -m "feat: introduce brand yellow + align surface/text tokens to logo palette

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Test locally in siab-payload using local registry

The `components.json` in siab-payload has a local registry alias (`@siab-local`) pointing at `file:///home/shimmy/Desktop/design-systems/public/r/v1/siab/`. Use it to test before touching the live registry server.

- [ ] **Step 1: Pull updated theme from local registry into siab-payload**

```bash
cd /home/shimmy/Desktop/env/siab/siab-payload
pnpm dlx shadcn@latest add "@siab-local/theme" --overwrite
```

Expected: `globals.css` is rewritten. No prompt — `--overwrite` is non-interactive.

- [ ] **Step 2: Confirm globals.css reflects the changes**

```bash
grep -E "brand|ring|sidebar-primary" src/styles/globals.css | head -20
```

Expected: `--brand: oklch(0.902 0.194 99)`, `--ring: oklch(0.902 0.194 99)`, `--sidebar-primary: oklch(0.902 0.194 99)` (in dark block).

---

### Task 4: Visual verification on dev server

- [ ] **Step 1: Ensure Postgres is running**

```bash
podman start siab-payload-postgres-dev
podman exec siab-payload-postgres-dev pg_isready -U payload -d payload
```

Expected: `accepting connections`

- [ ] **Step 2: Start dev server**

```bash
cd /home/shimmy/Desktop/env/siab/siab-payload
pnpm dev
```

- [ ] **Step 3: Verify light mode**

Open `http://localhost:3000/login` and `http://localhost:3000/admin`. Check:
- Body text is warm near-black (not pure black) — subtle but visible on close inspection
- Muted/secondary surfaces (sidebar hover rows, input backgrounds) have a faint cream tint
- Focus ring on any input/button is yellow when tabbing through
- Primary buttons have cream text (not pure white)

- [ ] **Step 4: Verify dark mode**

Toggle dark mode. Check:
- Active sidebar item indicator is yellow (not blue)
- Card and sidebar backgrounds have the faint warm tint vs pure grey
- Body text is warm cream (not pure white)
- Focus ring is yellow

- [ ] **Step 5: Verify chart**

Navigate to any dashboard page with a chart. Confirm series 4 is the brand yellow.

- [ ] **Step 6: Stop dev server**

`Ctrl+C`

---

### Task 5: Push design-systems and deploy registry server

- [ ] **Step 1: Push to GitHub**

```bash
cd /home/shimmy/Desktop/design-systems
git push origin main
```

- [ ] **Step 2: Deploy registry server on VPS**

```bash
ssh prod "cd /srv/saas/infra/stacks/design-systems && docker compose pull && docker compose up -d && docker compose ps"
```

(If the stack path differs, adjust accordingly — check with `ssh prod "find /srv -name 'docker-compose.yml' | xargs grep -l registries 2>/dev/null"`)

- [ ] **Step 3: Verify registry is serving the updated theme**

```bash
curl -s https://registries.optidigi.nl/r/v1/siab/theme.json | grep -o '"brand":"[^"]*"' | head -3
```

Expected: `"brand":"oklch(0.902 0.194 99)"`

---

### Task 6: Sync siab-payload from live registry and commit

- [ ] **Step 1: Run full registry check against live registry**

```bash
cd /home/shimmy/Desktop/env/siab/siab-payload
pnpm registry:check
```

Expected: exit 0 with no diff — confirms local `globals.css` already matches the live registry (since we applied the same changes via `@siab-local` in Task 3).

- [ ] **Step 2: Commit globals.css**

```bash
git add src/styles/globals.css
git commit -m "feat: pull brand color tokens from @siab registry

- brand yellow (oklch 0.902 0.194 99) wired to ring, sidebar-primary (dark), chart-4
- surface tokens aligned to logo palette (cream light / near-black dark)
- text tokens aligned to logo near-black (light) / cream (dark)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Typecheck, push siab-payload, and deploy prod

- [ ] **Step 1: Run typecheck**

```bash
cd /home/shimmy/Desktop/env/siab/siab-payload
pnpm typecheck
```

Expected: no errors (token changes don't affect TypeScript)

- [ ] **Step 2: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 3: Wait for CI build to complete**

```bash
until gh run list --repo Optidigi/siab-payload --limit 1 | grep -qv "in_progress"; do sleep 10; done
gh run list --repo Optidigi/siab-payload --limit 2
```

Expected: `completed success` for the build-image run.

- [ ] **Step 4: Deploy to prod VPS**

```bash
ssh prod "cd /srv/saas/infra/stacks/siab-payload && docker compose pull && docker compose up -d"
```

- [ ] **Step 5: Verify prod health**

```bash
ssh prod "curl -sf https://admin.siteinabox.nl/api/health"
```

Expected: `{"status":"ok","db":"connected","dataDir":"writable"}`

- [ ] **Step 6: Smoke-test prod visually**

Open `https://admin.siteinabox.nl/login` — confirm yellow focus ring and warm surfaces are visible in both light and dark mode.

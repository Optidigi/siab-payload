# Design: SiteInABox Brand Color Tokens

## What we're doing

Introducing the SiteInABox logo color palette into the `@siab` registry theme tokens — Option A (brand as accent, not primary). The logo is unchanged; the registry token values are aligned to it.

## Logo palette (source of truth)

| Role | RGB | oklch |
|---|---|---|
| Brand yellow | `rgb(245, 233, 0)` | `oklch(0.902 0.194 99)` |
| Cream / light marks | `rgb(245, 243, 238)` | `oklch(0.963 0.007 80)` |
| Near-black / dark marks | `rgb(43, 42, 42)` | `oklch(0.214 0.004 17)` |

## Token changes in `registry.json`

### 1 — New brand tokens (both modes, same value)

| Token | Value |
|---|---|
| `--brand` | `oklch(0.902 0.194 99)` |
| `--brand-foreground` | `oklch(0.214 0.004 17)` |

These must also be exposed in `@theme inline` so `bg-brand` / `text-brand-foreground` are available as Tailwind utilities.

### 2 — Existing slots rewired to brand yellow

| Slot | Mode | Before | After |
|---|---|---|---|
| `--ring` | light | `oklch(0.708 0 0)` | `oklch(0.902 0.194 99)` |
| `--ring` | dark | `oklch(0.556 0 0)` | `oklch(0.902 0.194 99)` |
| `--sidebar-primary` | dark | `oklch(0.488 0.243 264)` (blue) | `oklch(0.902 0.194 99)` |
| `--sidebar-primary-foreground` | dark | `oklch(0.985 0 0)` | `oklch(0.214 0.004 17)` |
| `--chart-4` | light | `oklch(0.828 0.189 84)` | `oklch(0.902 0.194 99)` |
| `--chart-4` | dark | `oklch(0.627 0.265 304)` (purple) | `oklch(0.902 0.194 99)` |

### 3 — Surface alignment to logo palette

| Slot | Mode | Before | After |
|---|---|---|---|
| `--card` | dark | `oklch(0.205 0 0)` | `oklch(0.214 0.004 17)` |
| `--sidebar` | dark | `oklch(0.205 0 0)` | `oklch(0.214 0.004 17)` |
| `--muted` | light | `oklch(0.97 0 0)` | `oklch(0.963 0.007 80)` |
| `--secondary` | light | `oklch(0.97 0 0)` | `oklch(0.963 0.007 80)` |
| `--accent` | light | `oklch(0.97 0 0)` | `oklch(0.963 0.007 80)` |

### 4 — Text alignment to logo palette

| Slot | Mode | Before | After |
|---|---|---|---|
| `--foreground` | light | `oklch(0.145 0 0)` | `oklch(0.214 0.004 17)` |
| `--card-foreground` | light | `oklch(0.145 0 0)` | `oklch(0.214 0.004 17)` |
| `--popover-foreground` | light | `oklch(0.145 0 0)` | `oklch(0.214 0.004 17)` |
| `--sidebar-foreground` | light | `oklch(0.145 0 0)` | `oklch(0.214 0.004 17)` |
| `--accent-foreground` | light | `oklch(0.205 0 0)` | `oklch(0.214 0.004 17)` |
| `--secondary-foreground` | light | `oklch(0.205 0 0)` | `oklch(0.214 0.004 17)` |
| `--primary-foreground` | light | `oklch(0.985 0 0)` | `oklch(0.963 0.007 80)` |
| `--foreground` | dark | `oklch(1 0.001 0)` | `oklch(0.963 0.007 80)` |
| `--card-foreground` | dark | `oklch(0.985 0 0)` | `oklch(0.963 0.007 80)` |
| `--popover-foreground` | dark | `oklch(0.985 0 0)` | `oklch(0.963 0.007 80)` |
| `--sidebar-foreground` | dark | `oklch(0.985 0 0)` | `oklch(0.963 0.007 80)` |

## What this looks like in the UI

- **Focus ring** — yellow outline on every focused element, both modes
- **Active sidebar item** (dark mode) — yellow indicator instead of blue
- **Chart series 4** — exact brand yellow, both modes
- **Dark mode cards/sidebar** — faint warm tint vs pure grey
- **Light mode muted surfaces** — faint cream tint vs pure white
- **Body text** — warm near-black (light) / warm cream (dark) vs neutral greys
- **Text on dark primary buttons** — cream instead of pure white

## Implementation workflow

1. Edit `packages/siab/registry.json` in `Optidigi/design-systems`
2. Commit + push design-systems
3. Deploy registry server on VPS (`docker compose pull && up -d`)
4. In siab-payload: `pnpm registry:check --overwrite` → rewrites `globals.css`
5. Start dev server, verify visually
6. Commit + push siab-payload → CI → deploy prod

## Contrast safety

- Logo near-black (`0.214`) on white background: ~14:1 — WCAG AAA
- Logo cream (`0.963`) on darkest background (`0.14`): ~13:1 — WCAG AAA
- All foreground changes remain well above the 4.5:1 AA threshold

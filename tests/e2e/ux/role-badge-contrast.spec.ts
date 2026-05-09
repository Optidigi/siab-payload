import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"
import { forceTheme, measureContrast, type ContrastSample } from "./_contrast"

/**
 * UX-2026-0017 (U12 / WCAG 1.4.3 Contrast (Minimum), Level AA) — every
 * <RoleBadge> across the admin must clear 4.5:1 against its composited bg
 * in BOTH light and dark themes. Uses canvas-based sRGB contrast computation
 * so the spec is self-contained (no axe-core fetch / public-asset dependency).
 *
 * The badge ships four role tones (super-admin / owner / editor / viewer);
 * each tone needs to be exercised on at least one walked surface. /users
 * shows all four (the four seeded users); /sites/<slug>/users shows three
 * (no super-admin in tenant team). Spec walks both surfaces in both themes.
 */

const ROLE_BADGE_SURFACES = [
  { url: "/users", label: "super-admin global users" },
  { url: "/sites/audit-test/users", label: "tenant team page" }
] as const

const BADGE_SELECTOR = '[data-slot="badge"]'

test.describe("UX-2026-0017 — RoleBadge contrast across themes + role tones", () => {
  for (const surface of ROLE_BADGE_SURFACES) {
    for (const theme of ["light", "dark"] as const) {
      test(`${surface.label} (${surface.url}) — ${theme} mode at 375×667`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 })
        await loginAsSuperAdmin(page)
        await page.goto(surface.url)
        await forceTheme(page, theme)
        const samples: ContrastSample[] = await measureContrast(page, BADGE_SELECTOR)
        expect(samples.length, `${surface.label} should render at least one badge`).toBeGreaterThan(0)
        for (const s of samples) {
          expect.soft(
            s.ratio,
            `${surface.label} ${theme} — ${s.selectorText} ratio (threshold ${s.threshold}:1)`
          ).toBeGreaterThanOrEqual(s.threshold)
        }
      })
    }
  }
})

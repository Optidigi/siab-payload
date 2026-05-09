import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0022 (U7) — the SaveStatusBar's dirty-state indicator should
 * resolve via shadcn `[data-slot="badge"]` (proper primitive, not an
 * ad-hoc Tailwind class stack). Anchored by GitHub issue #2.
 * Acceptance: when the form is dirty, the rendered status bar contains a
 * Badge element with text matching `\d+\s*unsaved`.
 *
 * Asserted on desktop (1280) because the SaveStatusBar is `hidden md:flex`
 * — phone has its own tabbar treatment.
 */

test("UX-2026-0022 — dirty-state indicator uses shadcn Badge with count", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await loginAsSuperAdmin(page)
  await page.goto("/sites/audit-test/pages/1")
  await page.waitForLoadState("networkidle")
  // Dirty the form: clear the Title field
  const title = page.getByRole("textbox", { name: /title\*/i }).first()
  await title.click()
  await title.fill("Home — dirty")
  // Wait for the SaveStatusBar to flip into "dirty" state
  await page.waitForTimeout(300)
  // The status bar is at top-right (md:top-16 md:right-4) and contains a
  // Badge whose text reads "{N} unsaved".
  const badge = page.locator('[data-slot="badge"]').filter({ hasText: /\d+\s*unsaved|unsaved/i }).first()
  await expect(badge).toBeVisible()
  await expect(badge).toHaveText(/\d+\s*unsaved/i)
  // Restore for test isolation
  await title.click()
  await title.fill("Home")
})

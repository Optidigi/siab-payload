import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0003 (U12 / WCAG 2.1.1 Keyboard, Level A) — the shadcn Table
 * primitive's scroll wrapper (`<div data-slot="table-container"
 * class="... overflow-x-auto">`) must be keyboard-focusable so kbd-only users
 * can scroll horizontally to reach off-screen columns. axe-core 4.10.2 reports
 * `scrollable-region-focusable` (impact: serious) when the wrapper is neither
 * focusable nor contains a focusable descendant.
 *
 * Acceptance: at a viewport that triggers horizontal scroll on the dashboard's
 * activity table, the `[data-slot="table-container"]` element receives focus
 * during a tab walk AND its `tabindex` resolves to a non-negative value.
 */

test.describe("UX-2026-0003 — overflow-x table-container keyboard-focusable", () => {
  test("dashboard activity-table container has tabIndex>=0 at mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAsSuperAdmin(page)
    await page.goto("/")
    const container = page.locator('[data-slot="table-container"]').first()
    await expect(container).toBeVisible()
    const tabIndex = await container.evaluate((el) => (el as HTMLElement).tabIndex)
    expect(tabIndex).toBeGreaterThanOrEqual(0)
  })

  test("focused container scrolls horizontally on ArrowRight when overflow exists", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAsSuperAdmin(page)
    await page.goto("/")
    const container = page.locator('[data-slot="table-container"]').first()
    await expect(container).toBeVisible()
    // Verify the table is wider than the wrapper (overflow exists) — otherwise
    // this test is vacuous, and we want to fail loudly if the dashboard is
    // restructured so the activity table no longer overflows.
    const overflowsHorizontally = await container.evaluate(
      (el) => el.scrollWidth > el.clientWidth
    )
    expect(overflowsHorizontally).toBe(true)
    const before = await container.evaluate((el) => el.scrollLeft)
    // Real Tab walk — confirms the container is reachable from the keyboard
    // (NOT just programmatically `.focus()`-able).
    let landed = false
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab")
      const slot = await page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.getAttribute("data-slot")
      )
      if (slot === "table-container") { landed = true; break }
    }
    expect(landed).toBe(true)
    await page.keyboard.press("ArrowRight")
    await page.waitForTimeout(100)
    const after = await container.evaluate((el) => el.scrollLeft)
    expect(after).toBeGreaterThan(before)
  })
})

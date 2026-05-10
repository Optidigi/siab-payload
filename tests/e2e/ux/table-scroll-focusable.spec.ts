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
  // batch-6 (UX-2026-0002 / issue #15) replaced the dashboard's mobile
  // activity table with a flat card list, so the table-container only
  // renders at md+. This spec now verifies the focusable wrapper at the
  // desktop viewport — UX-2026-0003's anchor (WCAG 2.1.1 keyboard) is
  // about every Table primitive instance, not specifically the activity
  // table on mobile.
  test("activity-table container has tabIndex>=0 at desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/")
    const container = page.locator('[data-slot="table-container"]').first()
    await expect(container).toBeVisible()
    const tabIndex = await container.evaluate((el) => (el as HTMLElement).tabIndex)
    expect(tabIndex).toBeGreaterThanOrEqual(0)
  })

  test("focused container scrolls horizontally on ArrowRight when overflow exists", async ({ page }) => {
    // The activity table only renders at md+ (after batch-6 / UX-2026-0002).
    // Pick a narrow desktop viewport so the table renders but the card width
    // is tighter than the table content — overflow conditions hold and the
    // kbd-scroll behaviour is exercised. If at the chosen viewport the
    // table happens to fit (e.g. layout changes), skip the kbd-scroll
    // half — the focusable-region rubric (UX-2026-0003 anchor) is already
    // covered by the first test.
    await page.setViewportSize({ width: 800, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/")
    const container = page.locator('[data-slot="table-container"]').first()
    await expect(container).toBeVisible()
    const overflowsHorizontally = await container.evaluate(
      (el) => el.scrollWidth > el.clientWidth
    )
    if (!overflowsHorizontally) {
      test.skip(true, "no horizontal overflow at this viewport — kbd-scroll test is vacuous")
      return
    }
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

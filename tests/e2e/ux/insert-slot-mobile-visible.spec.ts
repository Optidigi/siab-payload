import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0030 (U8) — InsertSlot inter-block "+ Add" pill must be visible
 * from initial render on mobile viewports (< md). The hover-only reveal
 * pattern (`group-hover:opacity-100`) is correct on desktop but leaves
 * touch users with an invisible affordance because `(hover: none)` media
 * detection is unreliable cross-browser. Tying visibility to the `md`
 * breakpoint instead of the hover media query captures the actual UX
 * dimension (phone vs desktop).
 *
 * Acceptance:
 *   - viewport 375: every `button[aria-label="Add"]` has opacity > 0
 *     from initial render (no hover, no focus, no interaction).
 *   - viewport 1280: opacity is 0 from initial render — desktop's
 *     hover-reveal pattern preserved.
 */

test.describe("UX-2026-0030 — InsertSlot Add pill visibility by viewport", () => {
  test("at 375 mobile: pills visible from initial render", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/pages/1")
    await page.waitForLoadState("networkidle")
    const data = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[aria-label="Add"]')) as HTMLElement[]
      return buttons.map((b) => ({
        opacity: parseFloat(getComputedStyle(b).opacity),
        height: Math.round(b.getBoundingClientRect().height)
      }))
    })
    expect(data.length, "page editor should render at least one InsertSlot Add pill").toBeGreaterThan(0)
    for (const [i, btn] of data.entries()) {
      expect.soft(btn.opacity, `InsertSlot[${i}] opacity > 0 at 375 viewport`).toBeGreaterThan(0)
      expect.soft(btn.height, `InsertSlot[${i}] keeps 44 px tap target at 375 viewport`).toBeGreaterThanOrEqual(44)
    }
  })

  test("at 1280 desktop: pills hidden until hover (preserve subtle affordance)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/pages/1")
    await page.waitForLoadState("networkidle")
    // Park the mouse in a corner so Playwright's auto-cursor-position
    // doesn't accidentally hover over the InsertSlot's parent `group`
    // (which would flip group-hover:opacity-100).
    await page.mouse.move(0, 0)
    const data = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[aria-label="Add"]')) as HTMLElement[]
      return buttons.map((b) => parseFloat(getComputedStyle(b).opacity))
    })
    expect(data.length).toBeGreaterThan(0)
    for (const [i, opacity] of data.entries()) {
      expect.soft(opacity, `InsertSlot[${i}] hidden by default at 1280 viewport`).toBe(0)
    }
  })
})

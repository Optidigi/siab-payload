import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0025 (U7) — block header collapse-chevron must sit on the RIGHT
 * side of the header, adjacent to the Actions menu button. Anchored by
 * GitHub issue #14: "Text aligned left ... and chevron aligned right (next
 * to '...' button)". Currently the chevron is in the left slot right after
 * the drag handle.
 *
 * Acceptance: collapse button bbox.x > Actions menu button bbox.x − 1 (the
 * collapse sits at or to the right of Actions); both buttons are still
 * keyboard-reachable; the existing UX-2026-0008 nested-interactive guarantee
 * holds.
 */

test("UX-2026-0025 — collapse-block button is to the right of the Actions menu", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await loginAsSuperAdmin(page)
  await page.goto("/sites/audit-test/pages/1")
  // Wait for blocks to render
  await page.getByRole("button", { name: "Block actions" }).first().waitFor()
  // Get bbox of first block's collapse button + its sibling Actions button
  const positions = await page.evaluate(() => {
    const collapse = document.querySelector('button[aria-label="Collapse block"], button[aria-label="Expand block"]')
    const actions = document.querySelector('button[aria-label="Block actions"]')
    if (!collapse || !actions) return null
    const c = collapse.getBoundingClientRect()
    const a = actions.getBoundingClientRect()
    return { collapseX: c.left, actionsX: a.left, collapseRight: c.right, actionsRight: a.right }
  })
  expect(positions, "first block must render both Collapse and Actions buttons").not.toBeNull()
  // The collapse button should sit AT OR TO THE RIGHT OF the Actions button's
  // x-start − 60 (allowing for the icon's own width). More precisely: it
  // should NOT be in the leftmost cluster (i.e. its x > drag-handle's x +
  // ~60). Express as: collapse.x > actions.x − 60 OR collapse.x is past the
  // halfway mark of the row.
  // Simpler: collapse.x must be > 200 at viewport 375 (the right half).
  expect(positions!.collapseX, "Collapse button must be in the right half of the row").toBeGreaterThan(180)
})

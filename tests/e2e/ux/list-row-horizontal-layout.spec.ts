import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0029 (U7) — list-row Cards on mobile must lay out HORIZONTALLY
 * (text left, Action button right) rather than vertically. Operator-flagged
 * after batch-3's DataTable refactor: the shadcn Card primitive defaults to
 * `flex flex-col` which made the user-supplied `flex items-start gap-2`
 * a no-op on direction (only `display:flex` was set, not direction). The
 * action button consequently fell to the BOTTOM of each card.
 *
 * Acceptance: Action button's vertical center sits within the row Link's
 * vertical span — i.e. they're side-by-side, not stacked.
 *
 * Asserted at 375 + 320 viewports (the U2 narrow floor).
 */

const SURFACES = ["/sites", "/sites/audit-test/pages", "/sites/audit-test/users"] as const

for (const url of SURFACES) {
  for (const w of [375, 320] as const) {
    test(`UX-2026-0029 — ${url} at ${w}px — Action button is to the RIGHT of row Link, not below`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 667 })
      await loginAsSuperAdmin(page)
      await page.goto(url)
      await page.waitForLoadState("networkidle")
      type Box = { x: number; y: number; w: number; h: number; right: number; bottom: number }
      type Data = {
        text: Box
        action: { x: number; y: number; w: number; h: number }
        actionCenterY: number
      } | null
      const data: Data = await page.evaluate(() => {
        const card = document.querySelector("[data-id]") as HTMLElement | null
        if (!card) return null
        // Reference text region — prefer the row-Open Link if present
        // (PagesTable, TenantsTable). UsersTable doesn't pass `getRowHref`
        // so its rows have no Open Link — fall back to the first content
        // div inside the Card.
        const link = card.querySelector('a[aria-label="Open"]') as HTMLElement | null
        const action = card.querySelector('button[aria-label^="Actions for "]') as HTMLElement | null
        if (!action) return null
        const text = (link ?? card.querySelector(":scope > div:not(.shrink-0)")) as HTMLElement | null
        if (!text) return null
        const tr = text.getBoundingClientRect()
        const ar = action.getBoundingClientRect()
        return {
          text: { x: tr.x, y: tr.y, w: tr.width, h: tr.height, right: tr.right, bottom: tr.bottom },
          action: { x: ar.x, y: ar.y, w: ar.width, h: ar.height },
          actionCenterY: ar.y + ar.height / 2
        }
      })
      expect(data, `${url} should render a row Card with both an Action button and text content`).not.toBeNull()
      const { text, action, actionCenterY } = data!
      // Action's vertical center must overlap the text region's vertical
      // span (i.e. they're side-by-side in the row, not stacked).
      expect.soft(
        actionCenterY,
        `${url}@${w} — action center Y should sit at or below text top edge`
      ).toBeGreaterThanOrEqual(text.y - 4)
      expect.soft(
        actionCenterY,
        `${url}@${w} — action center Y should sit at or above text bottom edge`
      ).toBeLessThanOrEqual(text.bottom + 4)
      // Action must be to the right of (or at least not before) the text's
      // left edge — sanity check that it isn't stacked left-aligned.
      expect.soft(
        action.x,
        `${url}@${w} — action.x should sit at or past the text's left edge`
      ).toBeGreaterThanOrEqual(text.x)
    })
  }
}

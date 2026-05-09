import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0005 (U1) — every "Actions for X" trigger on a list-row card
 * must have bbox >= 44×44 on mobile.
 *
 * UX-2026-0006 (U8) — the Actions button bbox must NOT overlap the
 * row-Open Link's bbox; restructured layout puts the Link in a flex
 * column and the Action button in its own sibling column.
 *
 * Anchored by GitHub issue #10. Asserted on /sites, /sites/<slug>/pages,
 * /sites/<slug>/users — all three list surfaces share the DataTable.
 */

const SURFACES = [
  { url: "/sites", label: "tenants list" },
  { url: "/sites/audit-test/pages", label: "pages list" },
  { url: "/sites/audit-test/users", label: "team list" }
] as const

test.describe("UX-2026-0005 + UX-2026-0006 — list-row Actions button (size + no overlap)", () => {
  for (const surface of SURFACES) {
    test(`${surface.label} (${surface.url}) — Actions buttons hit 44 floor + no overlap with row Link`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await loginAsSuperAdmin(page)
      await page.goto(surface.url)
      await page.waitForLoadState("networkidle")
      const result = await page.evaluate(() => {
        // The DataTable renders both the desktop table view and the mobile
        // card view in the DOM, gated by Tailwind's `md:hidden` /
        // `hidden md:block`. The hidden view's buttons measure 0×0; filter
        // them out so the spec only assesses the active mobile cards.
        const actionButtons = Array.from(
          document.querySelectorAll('button[aria-label^="Actions for "]')
        ).filter((b) => {
          const r = (b as HTMLElement).getBoundingClientRect()
          return r.width > 0 && r.height > 0
        }) as HTMLElement[]
        const offenders: Array<{ kind: string; label: string; data: unknown }> = []
        actionButtons.forEach((btn) => {
          const r = btn.getBoundingClientRect()
          const label = btn.getAttribute("aria-label") || ""
          if (r.height < 44 || r.width < 44) {
            offenders.push({ kind: "size", label, data: { width: Math.round(r.width), height: Math.round(r.height) } })
          }
          // Find the nearest ancestor Card (data-slot=card OR has role=button as the
          // row-Open Link ancestor). The row-Open Link is the absolutely-positioned
          // <a aria-label="Open"> in the same Card. After fix it's a flex child;
          // either way, assert: btn.bbox does NOT overlap any sibling Link bbox.
          let ancestor: HTMLElement | null = btn.parentElement
          while (ancestor && !ancestor.hasAttribute("data-slot")) ancestor = ancestor.parentElement
          if (!ancestor) return
          const link = ancestor.querySelector('a[aria-label="Open"]') as HTMLElement | null
          if (!link) return
          const lr = link.getBoundingClientRect()
          // Overlap = the two boxes share any pixels in both axes.
          const overlapX = Math.max(0, Math.min(r.right, lr.right) - Math.max(r.left, lr.left))
          const overlapY = Math.max(0, Math.min(r.bottom, lr.bottom) - Math.max(r.top, lr.top))
          if (overlapX > 0 && overlapY > 0) {
            offenders.push({
              kind: "overlap",
              label,
              data: { btn: { l: r.left, t: r.top, r: r.right, b: r.bottom }, link: { l: lr.left, t: lr.top, r: lr.right, b: lr.bottom } }
            })
          }
        })
        return { actionButtonCount: actionButtons.length, offenders }
      })
      expect(result.actionButtonCount, `${surface.label} should render at least one Actions button`).toBeGreaterThan(0)
      expect(result.offenders, JSON.stringify(result.offenders, null, 2)).toEqual([])
    })
  }
})

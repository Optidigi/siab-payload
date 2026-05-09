import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0028 (U7) — list-row Actions buttons should use a vertical-dots
 * icon (lucide-react `MoreVertical`, ⋮), matching the block-header pattern
 * (BlockListItem) and the user-menu trigger. Operator-flagged: "vertical
 * dots instead of horizontal".
 *
 * Lucide-react renders the MoreVertical alias as the renamed
 * `EllipsisVertical` icon (class `lucide-ellipsis-vertical`). We detect
 * it by class. The horizontal variant is `lucide-ellipsis` (or the
 * legacy `lucide-more-horizontal`); either presence is a fail.
 */

const SURFACES = ["/sites", "/sites/audit-test/pages", "/sites/audit-test/users"] as const

test.describe("UX-2026-0028 — list-row Actions use MoreVertical (⋮)", () => {
  for (const url of SURFACES) {
    test(`${url} — Actions button SVG has lucide-more-vertical class`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await loginAsSuperAdmin(page)
      await page.goto(url)
      await page.waitForLoadState("networkidle")
      const iconClasses = await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll('button[aria-label^="Actions for "]')
        ).filter((b) => {
          const r = (b as HTMLElement).getBoundingClientRect()
          return r.width > 0 && r.height > 0
        }) as HTMLElement[]
        return buttons.map((b) => {
          const svg = b.querySelector("svg")
          return {
            label: b.getAttribute("aria-label") || "",
            svgClasses: svg?.getAttribute("class") || ""
          }
        })
      })
      expect(iconClasses.length, `${url} should render at least one Actions button`).toBeGreaterThan(0)
      for (const i of iconClasses) {
        expect.soft(
          i.svgClasses,
          `${i.label} icon should be vertical-dots (lucide-ellipsis-vertical / lucide-more-vertical), got "${i.svgClasses}"`
        ).toMatch(/lucide-(ellipsis-vertical|more-vertical)\b/)
      }
    })
  }
})

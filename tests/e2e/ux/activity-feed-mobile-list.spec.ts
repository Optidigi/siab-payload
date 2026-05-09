import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0002 (U2 / GitHub issue #15) — the dashboard's Recent activity
 * feed renders a 5-column Table that overflows mobile viewports (~654 px
 * wide on 360 px viewport). On mobile the feed must instead render as a
 * flat list of `[data-slot="activity-row"]` rows that fit the card width;
 * the desktop Table is preserved at md+.
 */

test.describe("UX-2026-0002 — Recent activity mobile card-list", () => {
  test("on mobile (375), feed renders flat rows; no table; no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAsSuperAdmin(page)
    // Per-tenant dashboard has activity rows from the seeded edits
    await page.goto("/sites/audit-test")
    await page.waitForLoadState("networkidle")
    type Result = {
      found: true; hasTable: boolean; rowCount: number; cardWidth: number; maxRowWidth: number
    } | { found: false }
    const result: Result = await page.evaluate(() => {
      // Find the ActivityFeed Card by its title
      const headings = Array.from(document.querySelectorAll("[data-slot='card-title']"))
      const heading = headings.find((h) => h.textContent?.includes("Recent activity"))
      const card = heading?.closest("[data-slot='card']") as HTMLElement | null
      if (!card) return { found: false } as const
      // Need the VISIBLE table — mobile-branch parent has `hidden md:block`,
      // so the table element itself is in DOM but has 0 width/height. Filter
      // by visibility.
      const tableInside = card.querySelector("table") as HTMLElement | null
      const tableVisible = !!tableInside && tableInside.getBoundingClientRect().width > 0
      const rows = Array.from(card.querySelectorAll('[data-slot="activity-row"]'))
      const rowWidths = rows.map((r) => Math.round((r as HTMLElement).getBoundingClientRect().width))
      const cardWidth = Math.round(card.getBoundingClientRect().width)
      const maxRowWidth = rowWidths.length ? Math.max(...rowWidths) : 0
      return { found: true, hasTable: tableVisible, rowCount: rows.length, cardWidth, maxRowWidth } as const
    })
    expect(result.found, "ActivityFeed card should be rendered").toBe(true)
    if (!result.found) return
    expect(result.hasTable, "mobile branch must NOT render visible <table>").toBe(false)
    expect(result.rowCount, "mobile branch should render >= 1 activity row").toBeGreaterThan(0)
    expect(result.maxRowWidth).toBeLessThanOrEqual(result.cardWidth + 1)
  })

  test("on desktop (1280), feed still renders the table", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test")
    await page.waitForLoadState("networkidle")
    const hasTable = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("[data-slot='card-title']"))
      const heading = headings.find((h) => h.textContent?.includes("Recent activity"))
      const card = heading?.closest("[data-slot='card']") as HTMLElement | null
      const t = card?.querySelector("table") as HTMLElement | null
      return !!t && t.getBoundingClientRect().width > 0
    })
    expect(hasTable).toBe(true)
  })
})

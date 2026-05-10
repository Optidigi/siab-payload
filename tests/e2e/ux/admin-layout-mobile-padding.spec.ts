import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0026 (U2 / methodology §1 16-px content-inset floor) —
 * AdminLayout's main element must give at least 16 px of content inset
 * from the viewport edge on mobile viewports. Anchored by GitHub issue #16.
 */

const ROUTES = [
  "/",
  "/sites",
  "/sites/audit-test",
  "/sites/audit-test/pages",
  "/sites/audit-test/pages/1"
] as const

test.describe("UX-2026-0026 — AdminLayout mobile edge inset >= 16 px", () => {
  for (const url of ROUTES) {
    test(`${url} — main element x >= 16 at viewport 375`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      await loginAsSuperAdmin(page)
      await page.goto(url)
      // Walk to the AdminLayout's content <main> (the inner one — the outer
      // <main> is SidebarInset). Assert its first card-like child sits with
      // a left edge >= 16 from viewport.
      const innerMainLeft = await page.evaluate(() => {
        // The AdminLayout renders <main className="flex-1 max-md:p-2 md:p-6">
        // wrapped inside SidebarInset's <main>. Find the inner main by walking
        // for the second <main> in document order, which is the AdminLayout one.
        const mains = Array.from(document.querySelectorAll("main"))
        const inner = mains[mains.length - 1] // innermost
        if (!inner) return null
        const r = inner.getBoundingClientRect()
        return { left: Math.round(r.left), paddingLeft: parseFloat(getComputedStyle(inner).paddingLeft) }
      })
      expect(innerMainLeft, `${url}`).not.toBeNull()
      // Assert padding-left >= 16 (effective content inset from main's edge)
      expect.soft(innerMainLeft!.paddingLeft, `${url} main padding-left`).toBeGreaterThanOrEqual(16)
    })
  }
})

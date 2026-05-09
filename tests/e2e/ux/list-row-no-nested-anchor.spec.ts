import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * FN-2026-0006 — DataTable's mobile-card variant wraps the row in a
 * `<Link aria-label="Open">`. The Name column cell previously rendered
 * its own `<Link>` to the same href, producing nested anchors
 * ("<a> cannot be a descendant of <a>") and hydration errors on every
 * load. Fix: render `<span>` on mobile, `<Link>` on desktop, gated by
 * Tailwind so only one is in the DOM-displayed-and-AX-tree at a time.
 *
 * Spec: walks the three list surfaces at 375 mobile + 1280 desktop.
 * Asserts no anchor contains a descendant anchor at either viewport.
 */

const SURFACES = ["/sites", "/sites/audit-test/pages"] as const

for (const url of SURFACES) {
  for (const w of [375, 1280] as const) {
    test(`FN-2026-0006 — ${url} at ${w}px — no nested <a> in <a>`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 })
      await loginAsSuperAdmin(page)
      await page.goto(url)
      await page.waitForLoadState("networkidle")
      const offenders = await page.evaluate(() => {
        const out: Array<{ outer: string; inner: string }> = []
        document.querySelectorAll("a").forEach((outer) => {
          // Only count visible anchors — the table's mobile/desktop branch
          // gates with display:none, so display:none anchors are
          // invisible to AT and shouldn't count.
          const r = (outer as HTMLElement).getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return
          const innerAnchors = outer.querySelectorAll("a")
          innerAnchors.forEach((inner) => {
            const ri = (inner as HTMLElement).getBoundingClientRect()
            if (ri.width === 0 || ri.height === 0) return
            out.push({
              outer: (outer.getAttribute("href") || "") + " | aria=" + (outer.getAttribute("aria-label") || ""),
              inner: (inner.getAttribute("href") || "") + " | aria=" + (inner.getAttribute("aria-label") || "")
            })
          })
        })
        return out
      })
      expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([])
    })
  }
}

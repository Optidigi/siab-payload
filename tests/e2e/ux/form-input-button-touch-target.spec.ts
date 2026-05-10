import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0011 (U1) + UX-2026-0012 (U1) — every visible <input>, <textarea>,
 * <button>, and Radix combobox trigger on the admin must have bbox.height
 * >= 44 px on mobile viewports (Apple HIG / Material 48dp tap-target floor).
 *
 * The shadcn defaults previously used h-9 (36 px) on mobile + desktop; this
 * batch bumps to h-11 (44 px) on mobile while keeping h-9 on desktop for
 * super-admin density (per methodology U10 — internal surfaces may be denser).
 */

const SAMPLE_ROUTES = [
  "/login",
  "/sites",
  "/sites/audit-test/pages",
  "/sites/audit-test/pages/1",
  "/sites/audit-test/settings"
] as const

test.describe("UX-2026-0011 + UX-2026-0012 — form fields + buttons hit 44 floor on mobile", () => {
  for (const url of SAMPLE_ROUTES) {
    test(`${url} — every visible input/textarea/button has bbox.height >= 44`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
      if (url !== "/login") await loginAsSuperAdmin(page)
      await page.goto(url)
      await page.waitForLoadState("networkidle")
      const offenders = await page.evaluate(() => {
        const sel = 'input:not([type="hidden"]), textarea, button, [role="combobox"]'
        const out: Array<{ tag: string; type: string | null; height: number; label: string }> = []
        document.querySelectorAll(sel).forEach((el) => {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return
          const ariaLabel = el.getAttribute("aria-label") || ""
          if (ariaLabel.includes("Next.js Dev Tools")) return
          if (r.width <= 2 && r.height <= 2) return
          if (el.tagName === "IFRAME") return
          // Methodology §8 escape hatch — `data-size="sm"`, `xs`, `icon-sm`,
          // `icon-xs` opt the caller into a deliberate sub-floor variant for
          // dense (U10) contexts. Don't flag those — flag opt-out misuse on a
          // case-by-case basis as separate findings if they hit a mobile
          // primary-action surface.
          const dataSize = el.getAttribute("data-size") || ""
          if (["sm", "xs", "icon-sm", "icon-xs"].includes(dataSize)) return
          if (r.height < 44) {
            out.push({
              tag: el.tagName.toLowerCase(),
              type: (el as HTMLInputElement).type ?? null,
              height: Math.round(r.height),
              label: ariaLabel || (el as HTMLElement).innerText?.trim().slice(0, 30) || ""
            })
          }
        })
        return out
      })
      expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([])
    })
  }
})

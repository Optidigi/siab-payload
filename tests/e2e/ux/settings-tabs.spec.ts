import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0004 (U1) — settings tab triggers on /sites/<slug>/settings
 * must hit the 44 px tap-target floor on mobile AND show the visible
 * label alongside the icon (was icon-only at 34×29 in pass-1). Anchored
 * by GitHub issue #11.
 */

async function measureTabs(page: import("@playwright/test").Page) {
  return await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]')) as HTMLElement[]
    const tabsList = document.querySelector('[role="tablist"]') as HTMLElement | null
    return {
      tabs: tabs.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          text: el.innerText.trim(),
          height: Math.round(r.height),
          width: Math.round(r.width),
          right: Math.round(r.right),
          left: Math.round(r.left),
          ariaLabel: el.getAttribute("aria-label") || ""
        }
      }),
      listRight: tabsList?.getBoundingClientRect().right ?? 0,
      viewportWidth: window.innerWidth
    }
  })
}

for (const viewport of [{ w: 375, h: 667, name: "375 (iPhone-class)" }, { w: 320, h: 568, name: "320 (U2 floor)" }]) {
  test(`UX-2026-0004 — settings tabs at viewport ${viewport.name}: bbox >= 44 + visible label + no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.w, height: viewport.h })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/settings")
    await page.waitForLoadState("networkidle")
    const data = await measureTabs(page)
    expect(data.tabs.length, "settings should render at least one tab trigger").toBeGreaterThan(0)
    for (const t of data.tabs) {
      expect.soft(t.height, `tab "${t.ariaLabel}" height >= 44`).toBeGreaterThanOrEqual(44)
      expect.soft(t.text.length, `tab "${t.ariaLabel}" should have visible text content`).toBeGreaterThan(0)
      // No tab's right edge may exceed the viewport — labels must truncate
      // rather than overflow into the next column or the page-level scroll.
      expect.soft(t.right, `tab "${t.ariaLabel}" right edge inside viewport`).toBeLessThanOrEqual(data.viewportWidth)
    }
  })
}

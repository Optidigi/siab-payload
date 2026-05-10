import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * FN-2026-0007 — AppSidebar previously matched any path segment under
 * /sites/ as a tenant slug, including /sites/new (the create-tenant
 * form). The Content group then rendered Pages/Media/Forms/Settings/
 * Team/Onboarding links pointing at /sites/new/pages, all of which 404.
 * Fix: explicit reserved-segment list in AppSidebar.
 *
 * FN-2026-0023 — /sites/<slug>/pages/<bad-id> threw a 500 because
 * `payload.findByID` throws on missing rows and the page component
 * accessed `page.tenant` BEFORE its `notFound()` guard. Fix:
 * `.catch(() => null)` + an explicit `if (!page) notFound()` guard.
 */

test.describe("FN-2026-0007 + FN-2026-0023 — sidebar nav scope + 404 guard", () => {
  test("FN-2026-0007 — /sites/new does NOT render the tenant-Content sidebar group", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/new")
    await page.waitForLoadState("networkidle")
    // No /sites/new/pages, /sites/new/media, etc. links should be in the sidebar
    const brokenLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("aside a"))
        .map((a) => (a as HTMLAnchorElement).getAttribute("href") || "")
        .filter((href) => /^\/sites\/new\/(pages|media|forms|settings|users|onboarding)/.test(href))
    })
    expect(brokenLinks, JSON.stringify(brokenLinks)).toEqual([])
  })

  test("FN-2026-0023 — /sites/<slug>/pages/<bad-id> renders the standard not-found UI (not a 500 error page)", async ({ page }) => {
    await loginAsSuperAdmin(page)
    // Next.js dev mode reports 200 for `notFound()` server components even
    // though the rendered tree is the not-found.tsx; the meaningful
    // assertion is the rendered UI, not the HTTP status. The pre-fix shape
    // threw an unhandled error in the server component, which Next renders
    // as the "Application error" overlay containing "TypeError" / "Cannot
    // read properties of null".
    await page.goto("/sites/audit-test/pages/9999")
    await page.waitForLoadState("networkidle")
    // Use role-based + textContent assertions — innerText excludes elements
    // outside the layout-visible region in some Chromium configurations,
    // which masked the heading on isolated runs (the AppSidebar dominated
    // the viewport-visible text). textContent reads the whole DOM.
    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible()
    const fullText = await page.evaluate(() => document.body.textContent || "")
    // The pre-fix breakage produced an Application error / TypeError page
    expect(fullText).not.toMatch(/Application error|Cannot read prop/i)
  })
})

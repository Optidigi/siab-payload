import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"
import { slugify } from "../../../src/lib/slugify"

/**
 * fn-batch-6 cluster coverage — strategic spec hitting one assertion per
 * cluster rather than one per finding (volume management).
 */

test.describe("fn-batch-6 — Cluster E (silent redirect copy)", () => {
  test("FN-2026-0043 — /login?error=wrong-host renders an inline alert", async ({ page }) => {
    // Public route — no auth needed.
    await page.goto("/login?error=wrong-host")
    await page.waitForLoadState("networkidle")
    // Use the data-slot attribute set by the shadcn Alert primitive —
    // more specific than getByRole("alert") which can match Sonner's
    // toast region in some configurations.
    const alert = page.locator('[data-slot="alert"]')
    await expect(alert).toBeVisible({ timeout: 5000 })
    const body = (await alert.textContent()) ?? ""
    expect(body, "alert must include actionable copy").toMatch(/different site|tenant's admin/i)
  })

  test("FN-2026-0044 — /forgot-password has a Back-to-sign-in link", async ({ page }) => {
    await page.goto("/forgot-password")
    await page.waitForLoadState("networkidle")
    const backLinks = await page.locator('a[href="/login"]').count()
    expect(backLinks, "/forgot-password should expose at least one /login link").toBeGreaterThan(0)
  })
})

test.describe("fn-batch-6 — Cluster F (affordance gaps)", () => {
  test("FN-2026-0045 — Dashboard StatCards are clickable when href is provided", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    // The first stat card in super-admin mode links to /sites
    const statLinks = page.locator('a[href="/sites"]').filter({ hasText: /total tenants/i })
    await expect(statLinks.first(), "Total tenants stat card must be wrapped in a Link to /sites").toBeVisible()
    // FN-2026-0045 reviewer-DOWNGRADE regression guard — StatCards must
    // never link to a super-admin-only `/sites/<slug>/*` subroute from
    // the dashboard. (Pre-fix shape did exactly that for tenant-mode
    // operators, bouncing them back to /?error=forbidden.) Even in
    // super-admin mode no StatCard should target a per-tenant subroute
    // — only the global lists.
    const tenantSubroute = await page.locator('a[href*="/sites/"][href*="/pages"]').count()
    const formsSubroute = await page.locator('a[href*="/sites/"][href*="/forms"]').count()
    // Activity-feed rows DO link to /sites/<slug>/pages/<id> so the
    // assertion has to be scoped to the StatCards section. The cards
    // sit in the FIRST `grid-cols-2` direct child of the dashboard
    // wrapper.
    const cardsScope = page.locator(".grid.grid-cols-2").first()
    const subrouteInCards = await cardsScope.locator('a[href*="/sites/"]').count()
    expect(
      subrouteInCards,
      "StatCards must NOT link to /sites/<slug>/* subroutes (regression: tenant-mode owner would 403). Found anchors in cards scope."
    ).toBe(0)
    // The void variables silence any unused-warnings if used
    void tenantSubroute
    void formsSubroute
  })

  test("FN-2026-0046 — ActivityFeed page rows have drill-down links", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    // Look for any anchor href pattern /sites/<slug>/pages/<id> in the
    // Recent activity table area
    const activityLinks = page.locator("section, div").filter({ has: page.getByText(/recent activity/i) }).locator('a[href^="/sites/"][href*="/pages/"]')
    const count = await activityLinks.count()
    expect(count, "ActivityFeed must include drill-down links to /sites/<slug>/pages/<id>").toBeGreaterThan(0)
  })
})

test.describe("fn-batch-6 — Misc", () => {
  test("slugify util produces SLUG_REGEX-compliant output for typical inputs", async () => {
    expect(slugify("About us")).toBe("about-us")
    expect(slugify("Contact!! Page")).toBe("contact-page")
    expect(slugify("  Welcome to Acme  ")).toBe("welcome-to-acme")
    expect(slugify("")).toBe("")
    // Diacritic-stripped
    expect(slugify("Café résumé")).toBe("cafe-resume")
  })

  test("FN-2026-0033 follow-up — domain regex rejects all-numeric TLD", async ({ page }) => {
    await loginAsSuperAdmin(page)
    const status = await page.evaluate(async () => {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Numeric TLD",
          slug: "num-tld",
          domain: "1.2.3.4",
          status: "provisioning"
        })
      })
      return { status: res.status, body: (await res.text()).slice(0, 400) }
    })
    expect(status.status, `numeric TLD must be rejected: ${status.status} ${status.body}`).toBeGreaterThanOrEqual(400)
    expect(status.status).toBeLessThan(500)
  })
})

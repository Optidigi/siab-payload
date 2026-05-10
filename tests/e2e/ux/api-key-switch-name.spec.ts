import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0019 (U12 / WCAG 4.1.2 Name, Role, Value, Level A) — the API-key
 * Switch on /api-key must have an accessible name. axe-core 4.10.2 reports
 * `button-name` (impact: critical) when role="switch" buttons have no name.
 *
 * Acceptance: `page.getByRole('switch', { name: /api key/i })` resolves.
 * Asserted at both 375×667 mobile + 1280×800 desktop because shared chrome.
 */

test.describe("UX-2026-0019 — /api-key Switch accessible name", () => {
  test("at mobile viewport, the Switch resolves by role+name 'API key'", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAsSuperAdmin(page)
    await page.goto("/api-key")
    await expect(page.getByRole("switch", { name: /api key/i })).toBeVisible()
  })

  test("at desktop viewport, the Switch resolves by role+name 'API key'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/api-key")
    await expect(page.getByRole("switch", { name: /api key/i })).toBeVisible()
  })
})

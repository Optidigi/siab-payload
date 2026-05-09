import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0009 (U12 / WCAG 4.1.2 Name, Role, Value, Level A) — the Status
 * combobox on the page editor must have an accessible name. axe-core 4.10.2
 * reports `button-name` (impact: critical) when the trigger has none.
 *
 * Acceptance: `page.getByRole('combobox', { name: 'Status' })` resolves —
 * which only happens when the accessible-name computation lands on "Status"
 * (via aria-labelledby pointing at the FormLabel, an aria-label attr, or a
 * properly associated <label for=...>).
 *
 * Asserted on mobile (375) AND desktop (1280) viewports because the
 * PublishControls component renders two variants (card vs bare) gated by
 * isDesktop in PageForm.tsx — both must satisfy the rubric.
 */

test.describe("UX-2026-0009 — Status combobox accessible name", () => {
  test("at mobile viewport (375×667), the Status combobox has accessible name 'Status'", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/pages/1")
    await expect(page.getByRole("combobox", { name: "Status" })).toBeVisible()
  })

  test("at desktop viewport (1280×800), the Status combobox has accessible name 'Status'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/pages/1")
    await expect(page.getByRole("combobox", { name: "Status" })).toBeVisible()
  })
})

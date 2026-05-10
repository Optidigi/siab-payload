import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * fn-batch-10 — operator-flagged manual-test findings.
 *
 * FN-2026-0062 — MediaPicker eager-normalize bug. Pre-fix a useEffect
 * in MediaPicker.tsx called `onChange(value.id)` on mount whenever the
 * form was passed a populated Media object, which (a) flipped the
 * form's isDirty=true on render with no user input, and (b) replaced
 * the form value with a bare id while the picker's items grid was
 * empty — so the display lookup `items.find(m => m.id === id)` returned
 * undefined and the image visually disappeared on save.
 *
 * FN-2026-0063 — Settings logo field removed. Whitelabel feature out
 * of scope per operator; schema field remains for backwards compat.
 */

test.describe("fn-batch-10 — operator-flagged fixes", () => {
  test("FN-2026-0062 — page editor with existing OG image is CLEAN on mount (no spurious dirty)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    // Use a page that has populated SEO ogImage. Audit-test page 2.
    await page.goto("/sites/audit-test/pages/2")
    await page.waitForLoadState("networkidle")
    // Wait for any deferred effects to settle
    await page.waitForTimeout(1000)
    const dirtyBadge = page.locator('[data-slot="badge"]').filter({ hasText: /unsaved/i })
    expect(
      await dirtyBadge.count(),
      "Form must be CLEAN on mount — pre-fix MediaPicker eager-normalize dirtied it"
    ).toBe(0)
  })

  test("FN-2026-0063 — Settings page no longer renders the Logo field", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/settings")
    await page.waitForLoadState("networkidle")
    // Click Branding tab
    const brandingTab = page.getByRole("tab", { name: /branding/i }).first()
    await brandingTab.click()
    await page.waitForTimeout(500)
    // No "Logo" label should be visible
    const body = (await page.locator("body").textContent()) ?? ""
    // primaryColor is the remaining branding field
    expect(body).toMatch(/primary color/i)
    // The Branding tab content area should not include a "Logo" label
    const brandingTabContent = page.locator('[role="tabpanel"]').filter({ has: page.getByText(/primary color/i) })
    const tabText = (await brandingTabContent.textContent()) ?? ""
    expect(tabText, "Logo field must not be rendered in the Branding tab").not.toMatch(/logo/i)
  })
})

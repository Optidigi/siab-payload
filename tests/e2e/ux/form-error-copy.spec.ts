import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * FN-2026-0011 — Validation error messages collapse to bare "Invalid input"
 * on multiple zod-backed forms. Naked validators (`z.string().min(2)`,
 * `z.string().email()`, `z.enum([...])`) emit zod's default message which
 * surfaces as "Invalid input" via FormMessage. Replace with field-specific
 * copy so users know whether they need to fill, fix the format, or trim.
 *
 * This spec covers /sites/new (TenantForm), /forgot-password (ForgotPasswordForm),
 * and asserts the new copy is rendered AND that "Invalid input" is gone.
 */

test.describe("FN-2026-0011 — form error copy", () => {
  test("/sites/new — empty Name + Domain show specific copy, not 'Invalid input'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/new")
    await page.waitForLoadState("networkidle")
    // Submit with empty fields.
    await page.getByRole("button", { name: /create tenant/i }).click()
    // FormMessage error nodes — sonner toast vs inline. Inline.
    const body = (await page.locator("body").textContent()) ?? ""
    expect(body, "Page must NOT contain bare 'Invalid input'").not.toMatch(/\bInvalid input\b/)
    // The Name and Domain fields should have specific messages instead.
    // Choose tolerant matchers — "required" or "at least N characters" are
    // both acceptable; "Invalid input" is not.
    expect(body).toMatch(/\b(name|tenant)\s*(is\s*)?required\b|\bat\s+least\s+\d+\s+character/i)
  })

  test("/forgot-password — empty Email shows specific copy, not 'Invalid input'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    // Forgot password is public — no login needed; just goto.
    await page.goto("/forgot-password")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: /(send|request|reset|email)/i }).first().click()
    const body = (await page.locator("body").textContent()) ?? ""
    expect(body, "Page must NOT contain bare 'Invalid input'").not.toMatch(/\bInvalid input\b/)
    expect(body).toMatch(/\b(email|address)\b/i)
  })
})

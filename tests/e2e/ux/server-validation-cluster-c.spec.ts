import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * Cluster C — server-side validation gaps.
 *
 * FN-2026-0033 — POST /api/tenants with bad domain ("not a domain at all")
 *   must be REJECTED. Pre-fix returned 201.
 * FN-2026-0034 — SettingsForm zod schema rejects empty siteName client-side.
 * FN-2026-0056 — SettingsForm no longer sends `tenant` on PATCH.
 *   (Verified indirectly via successful save; cross-tenant attempt path
 *   is gone.)
 */

test.describe("Cluster C — server-side validation gaps", () => {
  test("FN-2026-0033 — POST /api/tenants rejects malformed domain", async ({ page }) => {
    await loginAsSuperAdmin(page)
    const status = await page.evaluate(async () => {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Bad Domain Tenant",
          slug: "bad-domain",
          domain: "not a domain at all",
          status: "provisioning"
        })
      })
      return { status: res.status, body: (await res.text()).slice(0, 400) }
    })
    expect(
      status.status,
      `POST should reject malformed domain; got ${status.status} ${status.body}`
    ).toBeGreaterThanOrEqual(400)
    expect(status.status).toBeLessThan(500)
  })

  test("FN-2026-0033 — POST /api/tenants accepts valid domain (regression guard)", async ({ page }) => {
    await loginAsSuperAdmin(page)
    // Use a unique slug + domain so the test doesn't collide with prior runs.
    const uniq = `vd-${Date.now().toString(36)}`
    const created = await page.evaluate(async (u) => {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Valid Domain Tenant",
          slug: u,
          domain: `${u}.test`,
          status: "provisioning"
        })
      })
      const j = await res.json().catch(() => null)
      return { status: res.status, id: j?.doc?.id ?? j?.id ?? null }
    }, uniq)
    expect(created.status, `valid domain should be accepted; got ${created.status}`).toBeLessThan(400)
    // Cleanup — DELETE the test tenant so subsequent runs don't accumulate
    if (created.id != null) {
      await page.evaluate(async (id) => {
        await fetch(`/api/tenants/${id}`, { method: "DELETE" })
      }, created.id)
    }
  })

  test("FN-2026-0034 — SettingsForm shows inline error on empty siteName (client-side zod)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/settings")
    await page.waitForLoadState("networkidle")
    // Wait for the General tab content (siteName input)
    const siteNameInput = page.getByRole("textbox", { name: /site name/i }).first()
    await expect(siteNameInput).toBeVisible({ timeout: 5000 })
    const original = await siteNameInput.inputValue()
    await siteNameInput.click()
    await siteNameInput.fill("")
    // Submit
    await page.getByRole("button", { name: /^save settings$/i }).first().click()
    // Inline error should appear (zod min(1)). Look for FormMessage with
    // "Site name is required" OR generic "required".
    const body = (await page.locator("body").textContent()) ?? ""
    const hasFieldErr = /Site name is required|siteName is required|name is required/i.test(body)
    expect(
      hasFieldErr,
      "Empty siteName must surface an inline zod error (not a generic Save-failed toast)"
    ).toBe(true)
    // Cleanup — restore original
    await siteNameInput.click()
    await siteNameInput.fill(original)
    await page.getByRole("button", { name: /^save settings$/i }).first().click()
    await expect(page.getByText(/^Saved$/i).first()).toBeVisible({ timeout: 10_000 })
  })
})

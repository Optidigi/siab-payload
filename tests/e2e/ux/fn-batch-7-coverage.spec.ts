import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * fn-batch-7 — close functional-audit-3's 3 findings.
 *
 * FN-2026-0057 — ActivityFeed mode-aware drill-down hrefs.
 * FN-2026-0058 — cross-tenant FK PATCH returns 400 (not 500) with field-tied error.
 * FN-2026-0059 — ApiKeyManager copy fix.
 */

test.describe("fn-batch-7 — audit-3 closure", () => {
  test("FN-2026-0058 — cross-tenant PATCH on Pages returns 400 with path:tenant", async ({ page }) => {
    await loginAsSuperAdmin(page)
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/pages/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: 999999 })
      })
      return { status: res.status, body: (await res.text()).slice(0, 500) }
    })
    expect(
      result.status,
      `Pages cross-tenant PATCH must be 400 (was: ${result.status} ${result.body})`
    ).toBeGreaterThanOrEqual(400)
    expect(result.status).toBeLessThan(500)
    expect(result.body).toMatch(/tenant/i)
  })

  test("FN-2026-0058 — cross-tenant PATCH on Media returns 400", async ({ page }) => {
    await loginAsSuperAdmin(page)
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/media/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: 999999 })
      })
      return { status: res.status, body: (await res.text()).slice(0, 500) }
    })
    expect(result.status, `Media cross-tenant PATCH must be 400 (was: ${result.status})`).toBeGreaterThanOrEqual(400)
    expect(result.status).toBeLessThan(500)
  })

  test("FN-2026-0058 — cross-tenant PATCH on SiteSettings returns 400", async ({ page }) => {
    await loginAsSuperAdmin(page)
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/site-settings/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: 999999 })
      })
      return { status: res.status, body: (await res.text()).slice(0, 500) }
    })
    expect(result.status, `SiteSettings cross-tenant PATCH must be 400 (was: ${result.status})`).toBeGreaterThanOrEqual(400)
    expect(result.status).toBeLessThan(500)
  })

  test("FN-2026-0060 — cross-tenant PATCH on Forms returns 400 (audit-4 sister regression)", async ({ page }) => {
    await loginAsSuperAdmin(page)
    // First find any forms doc; if none, this test is a smoke check that
    // the endpoint at least exists (the validate hook only fires when a
    // doc is actually being PATCHed).
    const result = await page.evaluate(async () => {
      const list = await fetch("/api/forms?limit=1")
      const j = await list.json()
      const id = j?.docs?.[0]?.id
      if (id == null) return { skip: true as const }
      const res = await fetch(`/api/forms/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: 999999 })
      })
      return { skip: false as const, status: res.status, body: (await res.text()).slice(0, 500) }
    })
    if (result.skip) {
      test.skip(true, "no forms doc to test against in this env")
      return
    }
    expect(result.status, `Forms cross-tenant PATCH must be 400 (was: ${result.status})`).toBeGreaterThanOrEqual(400)
    expect(result.status).toBeLessThan(500)
  })

  test("FN-2026-0060 — cross-tenant PATCH on BlockPresets returns 400", async ({ page }) => {
    await loginAsSuperAdmin(page)
    const result = await page.evaluate(async () => {
      const list = await fetch("/api/block-presets?limit=1")
      const j = await list.json()
      const id = j?.docs?.[0]?.id
      if (id == null) return { skip: true as const }
      const res = await fetch(`/api/block-presets/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: 999999 })
      })
      return { skip: false as const, status: res.status, body: (await res.text()).slice(0, 500) }
    })
    if (result.skip) {
      test.skip(true, "no block-presets doc to test against in this env")
      return
    }
    expect(result.status, `BlockPresets cross-tenant PATCH must be 400 (was: ${result.status})`).toBeGreaterThanOrEqual(400)
    expect(result.status).toBeLessThan(500)
  })

  test("FN-2026-0058 — same-tenant PATCH still works (regression guard)", async ({ page }) => {
    await loginAsSuperAdmin(page)
    const result = await page.evaluate(async () => {
      // Get current tenant id for page 1
      const get = await fetch("/api/pages/1")
      const doc = await get.json()
      const currentTenant = typeof doc.tenant === "object" ? doc.tenant.id : doc.tenant
      // Round-trip with same tenant — should pass.
      const res = await fetch("/api/pages/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant: currentTenant })
      })
      return { status: res.status }
    })
    expect(result.status).toBeLessThan(400)
  })

  test("FN-2026-0059 — ApiKeyManager copy no longer claims 'stores only a hash'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/api-key")
    await page.waitForLoadState("networkidle")
    const body = (await page.locator("body").textContent()) ?? ""
    expect(body, "ApiKeyManager copy must not contain the false 'stores only a hash' claim").not.toMatch(/stores only a hash/i)
    // Positive: should mention "encrypted" or similar honest framing.
    expect(body).toMatch(/encrypted|won't return|refuses to return|not return/i)
  })
})

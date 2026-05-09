import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * FN-2026-0004 — Server-side slug validation gap. Pre-fix, PATCH
 * /api/tenants/:id and PATCH /api/pages/:id accepted any string for `slug`
 * (e.g. "BAD SLUG!"). The client forms enforced regex but a direct REST
 * call (or browser console) bypassed it, persisting an invalid URL slug.
 *
 * GREEN target: Payload `validate:` hook on the slug field rejects
 * non-conforming strings server-side (returns 4xx with "Lowercase, digits,
 * hyphens only"). primaryColor is a similar gap (any free-text accepted) —
 * fix piggybacks on the same batch.
 */

test.describe("FN-2026-0004 — server-side slug validation", () => {
  test("PATCH /api/tenants/1 with bad slug is REJECTED", async ({ page }) => {
    await loginAsSuperAdmin(page)
    const status = await page.evaluate(async () => {
      const res = await fetch("/api/tenants/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "BAD SLUG!" })
      })
      return { status: res.status, text: (await res.text()).slice(0, 500) }
    })
    expect(
      status.status,
      `tenants PATCH must reject invalid slug; got ${status.status} ${status.text}`
    ).toBeGreaterThanOrEqual(400)
    expect(status.status).toBeLessThan(500)
  })

  test("PATCH /api/pages/1 with bad slug is REJECTED", async ({ page }) => {
    await loginAsSuperAdmin(page)
    const status = await page.evaluate(async () => {
      const res = await fetch("/api/pages/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "BAD SLUG!" })
      })
      return { status: res.status, text: (await res.text()).slice(0, 500) }
    })
    expect(
      status.status,
      `pages PATCH must reject invalid slug; got ${status.status} ${status.text}`
    ).toBeGreaterThanOrEqual(400)
    expect(status.status).toBeLessThan(500)
  })

  test("PATCH /api/tenants/1 with VALID slug still works (regression guard)", async ({ page }) => {
    await loginAsSuperAdmin(page)
    // We round-trip with the existing slug to avoid mutating the test
    // fixture, but use a known-valid format to exercise the validator
    // happy-path.
    const result = await page.evaluate(async () => {
      // Read current slug, then re-PATCH it as-is. Same slug = no actual
      // change but still hits the validator.
      const get = await fetch("/api/tenants/1")
      const tenant = await get.json()
      const res = await fetch("/api/tenants/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: tenant.slug })
      })
      return { status: res.status, slug: tenant.slug }
    })
    expect(result.status, `valid slug round-trip should pass; slug=${result.slug}`).toBeLessThan(400)
  })
})

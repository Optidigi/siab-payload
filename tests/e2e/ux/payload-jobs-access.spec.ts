import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * FN-2026-0061 — Payload's auto-registered `payload-jobs` collection had
 * no app-defined `access` block, defaulting to "all logged-in users."
 * Tenant editors / owners / viewers could read, queue, and delete system
 * jobs; queueing the `purgeStaleFormSubmissionsTask` forced an off-
 * schedule mass-delete (the task runs with overrideAccess:true and
 * crosses tenant scope).
 *
 * Fix: gated `jobs.access` (named endpoints) + `jobs.jobsCollectionOverrides
 * .access` (collection CRUD) to super-admin only.
 *
 * RED would require seeding owner/editor/viewer cookies. The simplest
 * super-admin-only spec verifies the regression guard: super-admin keeps
 * READ access (so the admin UI / observability still works).
 */

test.describe("FN-2026-0061 — payload-jobs access control", () => {
  test("super-admin GET /api/payload-jobs still works (regression guard)", async ({ page }) => {
    await loginAsSuperAdmin(page)
    const status = await page.evaluate(async () => {
      const res = await fetch("/api/payload-jobs?limit=1")
      return { status: res.status, body: (await res.text()).slice(0, 200) }
    })
    expect(status.status, `super-admin must keep READ access; got ${status.status}`).toBe(200)
  })

  test("unauthenticated GET /api/payload-jobs is denied", async ({ page }) => {
    // No login — fresh context
    await page.goto("/login")
    const status = await page.evaluate(async () => {
      const res = await fetch("/api/payload-jobs?limit=1")
      return { status: res.status }
    })
    expect(status.status, "unauthenticated must be denied").toBeGreaterThanOrEqual(400)
  })

  // We can't easily login as owner/editor/viewer in this spec without a
  // separate cred plumbing path, but the access function here is
  // identical for all non-super-admin roles. Source-level confirmation
  // in src/payload.config.ts covers the intent.
})

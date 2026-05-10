import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * FN-2026-0012 — after a successful save, the form's dirty state must
 * clear synchronously so the `useNavigationGuard` hook detaches its
 * beforeunload listener before the user can hit reload. The prior
 * `form.reset(values, { keepValues: true })` shape kept dirty=true for
 * a render tick, which left a window where a hard refresh fired the
 * browser-native "Leave site?" dialog AFTER the save had already
 * succeeded. `form.reset(values)` (without keepValues) advances the
 * dirty baseline synchronously.
 *
 * Acceptance:
 *   1. After dirtying a field, the SaveStatusBar's "{N} unsaved" badge
 *      is visible.
 *   2. After clicking Save and the success toast appears, the unsaved-
 *      badge is gone within the same frame (no race window).
 *   3. Following step 2, an immediate page.reload() does NOT raise a
 *      `beforeunload` dialog (Playwright's page.on('dialog') receives
 *      no event).
 */

test("FN-2026-0012 — post-save form clears dirty + beforeunload before reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await loginAsSuperAdmin(page)
  await page.goto("/sites/audit-test/pages/1")
  await page.waitForLoadState("networkidle")

  // 1. Dirty the form: append a marker to Title.
  const title = page.getByRole("textbox", { name: /title\*/i }).first()
  await title.click()
  await title.fill("Home — dirty marker")
  // Wait a tick for SaveStatusBar to flip to "dirty"
  await page.waitForTimeout(200)
  // The dirty badge surfaces "{N} unsaved" via the shadcn Badge primitive
  await expect(
    page.locator('[data-slot="badge"]').filter({ hasText: /\d+\s*unsaved/i }).first()
  ).toBeVisible()

  // 2. Click Save and wait for success toast.
  const saveBtn = page.getByRole("button", { name: /^save$/i }).first()
  await saveBtn.click()
  // Toast announces "Saved" or "Published" depending on the page status.
  await expect(page.getByText(/^(Saved|Published)$/i).first()).toBeVisible({ timeout: 10_000 })

  // 3. Immediately after the toast: dirty badge must be gone (clean state)
  await expect(
    page.locator('[data-slot="badge"]').filter({ hasText: /unsaved/i })
  ).toHaveCount(0)

  // 4. Reload the page; assert NO beforeunload dialog fires.
  let dialogFired = false
  page.on("dialog", (d) => {
    dialogFired = true
    void d.dismiss()
  })
  await page.reload()
  expect(dialogFired, "beforeunload dialog must NOT fire after a successful save").toBe(false)

  // Cleanup: restore Title to its seeded value so subsequent tests start clean.
  await page.waitForLoadState("networkidle")
  const restored = page.getByRole("textbox", { name: /title\*/i }).first()
  await restored.click()
  await restored.fill("Home")
  await page.getByRole("button", { name: /^save$/i }).first().click()
  await expect(page.getByText(/^(Saved|Published)$/i).first()).toBeVisible({ timeout: 10_000 })
})

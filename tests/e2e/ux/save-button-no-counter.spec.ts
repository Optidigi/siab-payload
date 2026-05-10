import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0021 (U7) — the desktop page-editor Save button must NOT render
 * an inline error-count pill (the `<span class="bg-destructive ...">`
 * counter inside the Button label). Anchored by GitHub issue #1.
 *
 * The mobile floating-save FAB (SaveStatusBar) is exempt; this spec
 * targets the desktop PublishControls Save button only.
 */

test("UX-2026-0021 — desktop Save button has no inline error-count pill after invalid submit", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await loginAsSuperAdmin(page)
  await page.goto("/sites/audit-test/pages/1")
  await page.waitForLoadState("networkidle")
  // Dirty + invalid: blank the required Title field. The zod schema marks
  // title required; emptying it dirties the form and on Save the validator
  // surfaces an error that PublishControls renders as a counter pill
  // (in the unfixed state).
  const title = page.getByRole("textbox", { name: /title\*/i }).first()
  await title.click()
  await title.fill("")
  // Click Save to trigger form.handleSubmit + RHF validation → errorCount
  // becomes >= 1.
  const saveBtn = page.getByRole("button", { name: /^save/i }).first()
  await saveBtn.click()
  // RHF validation is sync for zod; one tick is enough for the re-render.
  await page.waitForTimeout(200)
  const saveBtnRefreshed = page.getByRole("button", { name: /^save/i }).first()
  const hasPill = await saveBtnRefreshed.evaluate(
    (el) => !!el.querySelector('[class*="bg-destructive"]')
  )
  expect(hasPill, "desktop Save button must NOT carry an inline bg-destructive count pill").toBe(false)
  // Restore for subsequent test isolation
  await title.click()
  await title.fill("Home")
})

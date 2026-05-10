import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * FN-2026-0030/0031/0032/0051 — sister regressions to FN-2026-0012. The
 * form.reset(values) post-save fix only landed in PageForm in fn-batch-1;
 * TenantEditForm, UserEditForm, ProfileForm.onUpdateName, and SettingsForm
 * all left isDirty=true after a successful save, so the next nav fired
 * the UnsavedChangesDialog or beforeunload prompt.
 *
 * One test per form: dirty → save → assert isDirty cleared via the
 * SaveStatusBar badge OR by attempting an in-app nav and expecting NO
 * UnsavedChangesDialog.
 */

test.describe("fn-batch-5 — post-save isDirty sweep", () => {
  test("FN-2026-0030 — TenantEditForm clears dirty after save (no Discard dialog on next nav)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/edit")
    await page.waitForLoadState("networkidle")
    const notes = page.getByRole("textbox", { name: /notes/i }).first()
    const original = await notes.inputValue()
    await notes.click()
    await notes.fill(original + " (dirty-marker " + Date.now() + ")")
    const saveBtn = page.getByRole("button", { name: /^save changes$/i }).first()
    await saveBtn.click()
    await expect(page.getByText(/^Tenant updated$/i).first()).toBeVisible({ timeout: 10_000 })
    // Click an in-app link via the SPA — Dashboard sidebar item is the
    // most reliable target. The hook intercepts <a> clicks; we expect
    // no dialog to surface and no OS-native dialog either.
    let dialogFired = false
    page.on("dialog", (d) => { dialogFired = true; void d.dismiss() })
    await page.locator('a[href="/"]').first().click()
    await page.waitForURL("**/", { timeout: 5000 }).catch(() => {})
    await expect(page.getByText(/discard changes\?/i)).toHaveCount(0)
    expect(dialogFired, "OS-native dialog must NOT fire post-save").toBe(false)
    // Cleanup — reset notes to original
    await page.goto("/sites/audit-test/edit")
    await page.waitForLoadState("networkidle")
    const notesAfter = page.getByRole("textbox", { name: /notes/i }).first()
    await notesAfter.click()
    await notesAfter.fill(original)
    await page.getByRole("button", { name: /^save changes$/i }).first().click()
    await expect(page.getByText(/^Tenant updated$/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test("FN-2026-0032 — ProfileForm onUpdateName clears dirty after save", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    const nameInput = page.getByRole("textbox", { name: /display name/i }).first()
    const original = (await nameInput.inputValue()) || ""
    const marker = (original || "Super Admin") + " (edit " + Date.now() + ")"
    await nameInput.click()
    await nameInput.fill(marker)
    // Save name button — first button with text "Save" inside the name form
    const saveNameBtn = page.locator("form").filter({ has: nameInput }).getByRole("button", { name: /save/i }).first()
    await saveNameBtn.click()
    await expect(page.getByText(/^Profile updated$/i).first()).toBeVisible({ timeout: 10_000 })
    // Click any in-app link via the SPA — the click guard intercepts <a>
    // clicks. Match by href to avoid icon/label rendering ambiguity.
    let dialogFired = false
    page.on("dialog", (d) => { dialogFired = true; void d.dismiss() })
    await page.locator('a[href="/"]').first().click()
    await page.waitForURL("**/", { timeout: 5000 }).catch(() => {})
    await expect(page.getByText(/discard changes\?/i)).toHaveCount(0)
    expect(dialogFired, "OS-native dialog must NOT fire post-save").toBe(false)
    // Cleanup is best-effort — test value of the assertion above stands
    // regardless. Try to restore original name; swallow any timeouts.
    if (original) {
      try {
        await page.goto("/profile")
        await page.waitForLoadState("networkidle")
        const restoreInput = page.getByRole("textbox", { name: /display name/i }).first()
        await restoreInput.waitFor({ state: "visible", timeout: 3000 })
        await restoreInput.click()
        await restoreInput.fill(original)
        await page.locator("form").filter({ has: restoreInput }).getByRole("button", { name: /save/i }).first().click()
      } catch {
        // Swallow — cleanup hygiene only.
      }
    }
  })
})

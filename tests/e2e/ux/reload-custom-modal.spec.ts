import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * FN-2026-0028 (operator-flagged) — when a user presses Ctrl+R / Cmd+R / F5
 * on a dirty form, they get the OS-native "Leave site? Changes you made may
 * not be saved" alert. That's ugly and inconsistent with the in-app
 * "Discard changes? / Keep editing" custom dialog used for clicks and
 * back-button navigation.
 *
 * Caveat: the browser TOOLBAR refresh button + tab close + address-bar nav
 * remain OS-native (browsers don't expose an API to substitute a custom
 * dialog for a true unload). Keyboard reload is interceptable via a
 * `keydown` listener that calls preventDefault() before the browser fires
 * its own reload.
 *
 * Acceptance:
 *   1. Dirty the form.
 *   2. Press Ctrl+R (or Meta+R on macOS, but Playwright defaults to Linux).
 *   3. The custom Discard changes / Keep editing dialog appears.
 *   4. Browser does NOT auto-reload (no OS-native dialog).
 *   5. "Keep editing" closes the dialog AND preserves the dirty state.
 *   6. Pressing Ctrl+R + "Discard changes" actually reloads the page.
 */

test.describe("fn-batch-4 — custom modal for keyboard reload on dirty form", () => {
  test("Ctrl+R on dirty form opens custom dialog; Keep editing preserves state", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/edit")
    await page.waitForLoadState("networkidle")
    // Dirty the form.
    const notes = page.getByRole("textbox", { name: /notes/i }).first()
    await notes.click()
    await notes.fill("dirty-marker-keep-editing")
    // Track any OS-native dialog firing — there should be ZERO.
    let nativeDialogFired = false
    page.on("dialog", (d) => {
      nativeDialogFired = true
      void d.dismiss()
    })
    // Press Ctrl+R.
    await page.keyboard.press("Control+r")
    // Custom dialog must appear within a moment.
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 })
    await expect(page.getByText(/discard changes\?/i)).toBeVisible()
    expect(nativeDialogFired, "OS-native dialog must NOT fire when our keydown intercept runs first").toBe(false)
    // Click "Keep editing"
    await page.getByRole("button", { name: /keep editing/i }).click()
    // Dialog closed
    await expect(page.getByRole("dialog")).not.toBeVisible()
    // Form value preserved (dirty state intact)
    await expect(notes).toHaveValue("dirty-marker-keep-editing")
  })

  test("Ctrl+R + Discard changes actually reloads", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/edit")
    await page.waitForLoadState("networkidle")
    const notes = page.getByRole("textbox", { name: /notes/i }).first()
    await notes.click()
    await notes.fill("dirty-marker-discard")
    // Set a flag we can read after reload to verify a reload occurred.
    await page.evaluate(() => sessionStorage.setItem("siab.test.reload.before", "1"))
    let nativeDialogFired = false
    page.on("dialog", (d) => {
      nativeDialogFired = true
      void d.dismiss()
    })
    await page.keyboard.press("Control+r")
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 })
    expect(nativeDialogFired, "OS-native dialog must NOT fire").toBe(false)
    // Click Discard changes — reload happens.
    await page.getByRole("button", { name: /discard changes/i }).click()
    // Wait for the load triggered by the reload.
    await page.waitForLoadState("networkidle")
    // The form re-renders — the dirty marker should NOT be in the value
    // any more (server's persisted value wins).
    const notesAfter = page.getByRole("textbox", { name: /notes/i }).first()
    await expect(notesAfter).not.toHaveValue("dirty-marker-discard")
    // sessionStorage survives reload (distinguishes reload from full
    // navigation away and back, which would clear sessionStorage).
    const before = await page.evaluate(() => sessionStorage.getItem("siab.test.reload.before"))
    expect(before, "sessionStorage entry from before reload must survive (proves reload, not navigation)").toBe("1")
    await page.evaluate(() => sessionStorage.removeItem("siab.test.reload.before"))
  })

  test("Ctrl+R on a CLEAN form passes through (no dialog, normal reload)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/edit")
    await page.waitForLoadState("networkidle")
    // No edits — form is clean.
    let nativeDialogFired = false
    page.on("dialog", (d) => {
      nativeDialogFired = true
      void d.dismiss()
    })
    await page.evaluate(() => sessionStorage.setItem("siab.test.reload.clean", "1"))
    await page.keyboard.press("Control+r")
    // No custom dialog should appear.
    await page.waitForTimeout(500)
    await expect(page.getByRole("dialog")).not.toBeVisible()
    // Wait for reload to finish.
    await page.waitForLoadState("networkidle")
    expect(nativeDialogFired, "OS-native dialog must NOT fire on clean form").toBe(false)
    const flag = await page.evaluate(() => sessionStorage.getItem("siab.test.reload.clean"))
    expect(flag, "sessionStorage entry must survive — reload did happen").toBe("1")
    await page.evaluate(() => sessionStorage.removeItem("siab.test.reload.clean"))
  })
})

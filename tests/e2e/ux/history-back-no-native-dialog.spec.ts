import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * FN-2026-0027 — Form-dirty + history.back was reported by the audit
 * reviewer to fire the OS-native beforeunload dialog despite the
 * sentinel-pushState pattern in `useNavigationGuard`. This spec
 * reproduces the scenario and asserts the OS-native dialog does NOT
 * fire — the custom dialog should appear instead via the popstate
 * branch of the guard.
 */

test.describe("FN-2026-0027 — history.back on dirty form should surface custom dialog only", () => {
  test("press browser Back after dirty edit — no OS-native beforeunload prompt", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    // Navigate via /sites first (so there's a real prior history entry
    // to go back TO; otherwise back-from-first-entry has no destination
    // and the browser ignores it).
    await page.goto("/sites")
    await page.waitForLoadState("networkidle")
    await page.goto("/sites/audit-test/edit")
    await page.waitForLoadState("networkidle")
    // Dirty the form.
    const notes = page.getByRole("textbox", { name: /notes/i }).first()
    await notes.click()
    await notes.fill("dirty-marker-history-back")
    let nativeDialogFired = false
    page.on("dialog", (d) => {
      nativeDialogFired = true
      void d.dismiss()
    })
    // Press the browser back button (history.back).
    await page.goBack({ waitUntil: "domcontentloaded" })
    // Custom dialog should appear (popstate branch).
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 })
    expect(
      nativeDialogFired,
      "OS-native beforeunload dialog must NOT fire on history.back when sentinel pattern is working"
    ).toBe(false)
    // Click Keep editing — should restore us to /edit and clear pending.
    await page.getByRole("button", { name: /keep editing/i }).click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await expect(notes).toHaveValue("dirty-marker-history-back")
  })
})

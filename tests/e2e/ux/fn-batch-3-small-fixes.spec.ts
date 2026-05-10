import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * fn-batch-3 small fixes
 *
 * FN-2026-0019 — Toaster duration is too short (Sonner default ~4s). Bumped to
 * 6s so the user can actually read the success message. Asserts that the
 * configured Toaster carries `duration` >= 6000.
 *
 * FN-2026-0024 — Delete-tenant Path B copy says "1 media files" (always
 * pluralized noun). Asserts the singular form is present when counts.media === 1.
 *
 * FN-2026-0026 — UserMenu trigger button has no accessible name beyond the
 * avatar initial. Asserts the trigger has an aria-label.
 */

test.describe("fn-batch-3 — toast duration + plural copy + UserMenu a11y", () => {
  test("FN-2026-0019 — toast remains visible for at least 5 seconds (Sonner default would dismiss earlier)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    // Onboarding's Copy button calls toast.success("Copied") — a clean,
    // synchronous trigger that doesn't depend on a network round-trip.
    await page.goto("/sites/audit-test/onboarding")
    await page.waitForLoadState("networkidle")
    // Click the first Copy button. Allow clipboard since the button uses
    // navigator.clipboard.writeText.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
    const firstCopy = page.getByRole("button", { name: /^copy$/i }).first()
    await firstCopy.click()
    const toast = page.locator("[data-sonner-toast]").first()
    await expect(toast).toBeVisible()
    // Sonner's default duration is 4s. With our 6s prop, the toast must
    // still be visible 5s after firing. Wait 5000ms and assert.
    await page.waitForTimeout(5000)
    await expect(toast).toBeVisible()
  })

  test("FN-2026-0024 — pluralization in TenantEditForm danger-zone copy is count-aware", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/edit")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("heading", { name: /^danger zone$/i })).toBeVisible()
    // Walk each <li> in the danger-zone list — adjacent <li> textContent
    // glues together without separators in `body.textContent`, so list
    // items are the right unit of analysis.
    const lis = await page.locator("section ul > li").allTextContents()
    const mediaLi = lis.find((t) => /\bmedia\s+file/.test(t))
    expect(mediaLi, "Danger zone list must include a media-file item").toBeDefined()
    if (mediaLi) {
      const m = mediaLi.match(/^(\d+)\s+media\s+file(s?)$/)
      expect(m, `Media li must match the count + noun pattern: ${JSON.stringify(mediaLi)}`).not.toBeNull()
      if (m) {
        const count = Number(m[1])
        const pluralS = m[2]
        if (count === 1) expect(pluralS, "1 must NOT pluralize").toBe("")
        else expect(pluralS, `${count} must pluralize`).toBe("s")
      }
    }
    // Open the dialog and verify the same invariant — the FN-0024 finding
    // originated from the dialog.
    await page.getByRole("button", { name: /^delete tenant$/i }).click()
    await page.waitForSelector("[role=dialog]", { state: "visible" })
    // Dialog has the count inline within a paragraph, not a list. Pull
    // the entire dialog body, then look for "<n> media file" / "<n> media
    // files" surrounded by the comma the description uses as separator.
    const dialogText = (await page.locator("[role=dialog]").textContent()) ?? ""
    const dm = dialogText.match(/(\d+)\s+media\s+file(s?)[,\s]/)
    expect(dm, `Dialog must mention media count: ${JSON.stringify(dialogText)}`).not.toBeNull()
    if (dm) {
      const dCount = Number(dm[1])
      const dPluralS = dm[2]
      if (dCount === 1) expect(dPluralS, "Dialog: 1 must NOT pluralize").toBe("")
      else expect(dPluralS, `Dialog: ${dCount} must pluralize`).toBe("s")
    }
  })

  test("FN-2026-0026 — UserMenu trigger has an accessible name", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    // The trigger sits in the header. It's a <button> wrapping an Avatar.
    // We look for it by structure first, then assert it has an aria-label.
    const trigger = page.locator("header button[aria-haspopup='menu']").last()
    await expect(trigger).toBeVisible()
    const ariaLabel = await trigger.getAttribute("aria-label")
    expect(ariaLabel, "UserMenu trigger must carry an aria-label").not.toBeNull()
    expect((ariaLabel ?? "").length, "aria-label must be non-empty").toBeGreaterThan(0)
  })
})

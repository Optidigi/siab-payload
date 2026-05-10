import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * FN-2026-0008 — Onboarding "Mark done" toggle is in-memory only — refresh
 * wipes all checks. The pre-fix shape persisted nothing; toggling worked
 * visually but the next page load lost the state. The minimum viable
 * persistence here is per-browser localStorage keyed by tenant.id, which
 * survives refresh + close-and-reopen on the same machine. DB-backed
 * persistence is the appropriate next step but out-of-scope for this batch.
 *
 * RED: toggle "Add DNS A record" → reload → state lost (pre-fix).
 * GREEN: same flow → state preserved on reload.
 */

test.describe("FN-2026-0008 — onboarding persistence across reload", () => {
  test("toggle 'Add DNS A record' done; reload; state preserved", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/onboarding")
    await page.waitForLoadState("networkidle")
    // Clear localStorage and reload to a known starting state.
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState("networkidle")
    // Use a card-scoped locator pinned to the DNS step's title, then look
    // up to the nearest Card and find the toggle button INSIDE it. Each
    // card's CardContent contains exactly one toggle button (left side).
    const cardLocator = (titleRegex: RegExp) =>
      page.locator("[data-slot=card]", { has: page.getByText(titleRegex) })
    const dnsCard = cardLocator(/^Add DNS A record$/)
    await expect(dnsCard).toBeVisible()
    const dnsToggle = dnsCard.locator("button").first()
    // Pre-toggle: aria-label should be "Mark done" (state.done[dns]=false)
    await expect(dnsToggle).toHaveAttribute("aria-label", "Mark done")
    await dnsToggle.click()
    // Post-toggle: aria-label flipped
    await expect(dnsToggle).toHaveAttribute("aria-label", "Mark incomplete")
    // Reload and verify state survives.
    await page.reload()
    await page.waitForLoadState("networkidle")
    const dnsCardAfterReload = cardLocator(/^Add DNS A record$/)
    const dnsToggleAfterReload = dnsCardAfterReload.locator("button").first()
    await expect(
      dnsToggleAfterReload,
      "after reload, DNS step must remain marked done"
    ).toHaveAttribute("aria-label", "Mark incomplete")
    // Cleanup — toggle back to "Mark done" so the test is idempotent.
    await dnsToggleAfterReload.click()
  })
})

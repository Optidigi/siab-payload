import { test, expect } from "@playwright/test"

/**
 * UX-2026-0023 (U7 / GitHub issue #9) — /login adopts the shadcn login-03
 * pattern: muted background, brand mark above the centered card, card
 * header with greeting + description.
 *
 * Acceptance:
 *   - Brand mark "SiteInABox" link visible above the card.
 *   - Card title is a greeting ("Welcome back" or similar).
 *   - Outer wrapper has the muted background.
 *   - Email + password + Sign in button still functional.
 */

test.describe("UX-2026-0023 — login redesigned per shadcn login-03", () => {
  for (const w of [375, 1280] as const) {
    test(`/login at ${w}px — brand mark + greeting + muted bg`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 })
      await page.goto("/login")
      await page.waitForLoadState("networkidle")
      // Brand mark — a link containing "SiteInABox" rendered above the card
      const brand = page.getByRole("link", { name: /siteinabox/i }).first()
      await expect(brand).toBeVisible()
      // Card greeting
      const greeting = page.getByText(/welcome back|sign in to/i).first()
      await expect(greeting).toBeVisible()
      // Muted bg on the outer wrapper
      const hasMutedBg = await page.evaluate(() => {
        const main = document.querySelector("main")
        return main?.className.includes("bg-muted") ?? false
      })
      expect(hasMutedBg).toBe(true)
      // Existing form fields still functional
      await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
      await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
    })
  }
})

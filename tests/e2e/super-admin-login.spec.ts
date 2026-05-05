import { test, expect } from "@playwright/test"
import { ensureE2EUser } from "./_setup"

test("super-admin login + dashboard renders", async ({ page }) => {
  const creds = await ensureE2EUser()

  await page.goto("/login")
  await page.fill('input[type="email"]', creds.email)
  await page.fill('input[type="password"]', creds.password)
  await page.click('button:has-text("Sign in")')

  await page.waitForURL("/")
  // Stat card labels from Phase 7's dashboard
  await expect(page.getByText(/Total tenants|Published pages/i).first()).toBeVisible({ timeout: 15_000 })
})

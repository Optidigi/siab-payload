import { test, expect } from "@playwright/test"
import { ensureE2EUser } from "./_setup"

test("/login is reachable; bad credentials show error", async ({ page }) => {
  await ensureE2EUser()
  await page.goto("/login")
  await page.fill('input[type="email"]', "e2e-sa@test.local")
  await page.fill('input[type="password"]', "WRONG_PASSWORD")
  await page.click('button:has-text("Sign in")')
  // Toast appears on failed login (Phase 6's LoginForm)
  await expect(page.getByText(/Invalid email or password/i)).toBeVisible({ timeout: 10_000 })
})

test("authenticated routes redirect to /login when unauthenticated", async ({ page }) => {
  // No login. Visit a protected route.
  const res = await page.goto("/sites")
  // Either we end up at /login (redirect followed) or page renders the login form.
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
})

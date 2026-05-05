import { test, expect } from "@playwright/test"
import { ensureE2EUser, cleanupE2ETenant } from "./_setup"

test("super-admin: create tenant + publish page", async ({ page }) => {
  const slug = `e2e-${Date.now()}`
  await cleanupE2ETenant(slug)
  const creds = await ensureE2EUser()

  await page.goto("/login")
  await page.fill('input[type="email"]', creds.email)
  await page.fill('input[type="password"]', creds.password)
  await page.click('button:has-text("Sign in")')
  await page.waitForURL("/")

  // Create tenant
  await page.goto("/sites/new")
  await page.fill('input[name="name"]', "E2E Tenant")
  await page.fill('input[name="slug"]', slug)
  await page.fill('input[name="domain"]', `${slug}.test`)
  await page.click('button:has-text("Create tenant")')
  // Either lands on /sites/<slug>/onboarding or shows a toast
  await page.waitForURL(new RegExp(`/sites/${slug}`), { timeout: 20_000 })

  // Create + publish a page
  await page.goto(`/sites/${slug}/pages/new`)
  await page.fill('input[name="title"]', "E2E Home")
  await page.fill('input[name="slug"]', "home")

  // Add a Hero block
  await page.click('button:has-text("Add block")')
  await page.click('button:has-text("hero")')
  // Fill the hero block's headline
  await page.fill('input[name="blocks.0.headline"]', "E2E Welcome")

  // Set status to Published
  // The Status Select trigger from Phase 9's PageForm (radix Select)
  await page.locator('button[role="combobox"]').first().click()
  await page.getByRole('option', { name: 'Published' }).click()

  await page.click('button:has-text("Save")')

  // After save, should redirect to /sites/<slug>/pages/<id>
  await expect(page).toHaveURL(new RegExp(`/sites/${slug}/pages/\\d+`), { timeout: 20_000 })
  await expect(page.getByText("Published").first()).toBeVisible({ timeout: 10_000 })

  // Cleanup
  await cleanupE2ETenant(slug)
})

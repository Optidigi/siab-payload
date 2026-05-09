import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0024 (U9) — when a page is tenant-scoped, the PageHeader renders
 * the tenant context as a shadcn Breadcrumb (`<nav data-slot="breadcrumb">`)
 * rather than an isolated bordered-pill row above the H1. The breadcrumb
 * sits above the H1 with a chevron separator pointing INTO the H1's text;
 * the tenant link is the parent crumb, the H1 IS the current page (and
 * also represented as <BreadcrumbPage> for accessibility / consistency).
 *
 * Anchored by GitHub issue #12.
 */

test("UX-2026-0024 — tenant-scoped page header renders shadcn Breadcrumb above the H1", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await loginAsSuperAdmin(page)
  await page.goto("/sites/audit-test/pages/1")
  await page.waitForLoadState("networkidle")
  // Find the breadcrumb in the page header (NOT a sidebar / dialog one).
  const breadcrumb = page.locator('[data-slot="breadcrumb"]').first()
  await expect(breadcrumb).toBeVisible()
  // Tenant link as a BreadcrumbLink wrapping a Next Link to /sites/<slug>
  const tenantLink = breadcrumb.locator('a[href="/sites/audit-test"]').first()
  await expect(tenantLink).toBeVisible()
  await expect(tenantLink).toContainText("Audit Test Tenant")
  // Last crumb is the current page (Home) — represented as BreadcrumbPage
  // (a span with aria-current="page").
  const currentPage = breadcrumb.locator('[data-slot="breadcrumb-page"]').first()
  await expect(currentPage).toContainText("Home")
})

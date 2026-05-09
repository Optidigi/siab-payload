import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0008 (U12 / WCAG 4.1.2 Name, Role, Value, Level A) — the page
 * editor's block panel must not have a `role="button"` (or other interactive
 * role) wrapping nested interactive controls. axe-core 4.10.2 reports
 * `nested-interactive` (impact: serious) when this happens.
 *
 * Acceptance: no element matching INTERACTIVE_OUTER contains a descendant
 * that matches INTERACTIVE_INNER on /sites/audit-test/pages/1 at both
 * mobile + desktop viewports.
 *
 * The DnD Kit drag affordance is preserved by attaching its sortable
 * attributes (role="button", aria-roledescription="sortable", etc.) to
 * the explicit drag-handle button per the dnd-kit drag-handle pattern.
 */

const INTERACTIVE_OUTER =
  '[role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="combobox"]'
const INTERACTIVE_INNER =
  'button, a, input, textarea, select, [role="button"], [role="link"], [role="combobox"]'

test.describe("UX-2026-0008 — block panel has no nested-interactive ancestors", () => {
  test("no nested-interactive on page editor at mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/pages/1")
    const offenders = await page.evaluate(
      ({ outer, inner }: { outer: string; inner: string }) => {
        const out: Array<{ outerLabel: string; innerCount: number }> = []
        document.querySelectorAll(outer).forEach((el) => {
          // Skip the outer element itself when checking descendants
          const nested = el.querySelectorAll(inner)
          if (nested.length > 0 && el.matches(outer)) {
            // Filter out: an outer that IS a button (allowed to be a
            // standalone button as long as it doesn't contain another button)
            // — we still want to flag only outer<->inner nesting.
            out.push({
              outerLabel: el.tagName + (el.getAttribute("aria-label") ? `[aria-label="${el.getAttribute("aria-label")}"]` : ""),
              innerCount: nested.length
            })
          }
        })
        return out
      },
      { outer: INTERACTIVE_OUTER, inner: INTERACTIVE_INNER }
    )
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([])
  })

  test("no nested-interactive on page editor at desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/pages/1")
    const offenders = await page.evaluate(
      ({ outer, inner }: { outer: string; inner: string }) => {
        const out: Array<{ outerLabel: string; innerCount: number }> = []
        document.querySelectorAll(outer).forEach((el) => {
          const nested = el.querySelectorAll(inner)
          if (nested.length > 0) {
            out.push({
              outerLabel: el.tagName + (el.getAttribute("aria-label") ? `[aria-label="${el.getAttribute("aria-label")}"]` : ""),
              innerCount: nested.length
            })
          }
        })
        return out
      },
      { outer: INTERACTIVE_OUTER, inner: INTERACTIVE_INNER }
    )
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([])
  })
})

import { test, expect } from "@playwright/test"
import { loginAsSuperAdmin } from "./_helpers"

/**
 * UX-2026-0010 (U12 / WCAG 1.4.3 Contrast (Minimum), Level AA) — the Danger
 * zone block on the page editor must meet 4.5:1 contrast for normal text and
 * 3:1 for large text (≥18pt regular OR ≥14pt bold). axe-core 4.10.2 reports
 * `color-contrast` (impact: serious), 3 nodes:
 *   - <h2 class="text-base font-semibold text-destructive">Danger zone</h2>
 *     (16px, weight 600 — axe applies the 4.5:1 threshold because 600 < 700)
 *   - <p class="text-sm text-muted-foreground">Deleting page <strong>Home</strong>...</p>
 *   - <strong>Home</strong> inheriting muted-foreground
 *
 * Acceptance: each measured pair clears its WCAG threshold against the
 * composited section background (`bg-destructive/5` over the card bg).
 */

type ContrastSample = {
  selectorText: string
  ratio: number
  threshold: number
}

async function measureDangerZone(page: import("@playwright/test").Page): Promise<ContrastSample[]> {
  return await page.evaluate(() => {
    // Helper: parse any rgb()/rgba()/oklch()/oklab()/hsl() the browser computed
    // back into [r, g, b] in the 0..1 sRGB linear space, by drawing onto a
    // 1×1 canvas and reading the pixel (the browser does the colour-space
    // conversion for us). Returns null if the colour is fully transparent.
    function parseToSrgb(css: string): [number, number, number, number] | null {
      const c = document.createElement("canvas")
      c.width = 1; c.height = 1
      const ctx = c.getContext("2d")!
      ctx.fillStyle = "rgba(0,0,0,0)"
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return [r! / 255, g! / 255, b! / 255, (a as number) / 255]
    }
    // sRGB -> relative luminance per WCAG 2.x
    function relLum([r, g, b]: [number, number, number]): number {
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }
    // Composite a translucent fg over an opaque bg
    function composite(over: [number, number, number, number], under: [number, number, number]): [number, number, number] {
      const a = over[3]
      return [
        over[0] * a + under[0] * (1 - a),
        over[1] * a + under[1] * (1 - a),
        over[2] * a + under[2] * (1 - a)
      ]
    }
    function effectiveBackground(el: HTMLElement): [number, number, number] {
      // Walk up, compositing translucent backgrounds onto the next, until we
      // hit an opaque colour or the document root (which we treat as white).
      let stack: Array<[number, number, number, number]> = []
      let p: HTMLElement | null = el
      while (p) {
        const cs = getComputedStyle(p).backgroundColor
        const c = parseToSrgb(cs)
        if (c && c[3] > 0) {
          stack.push(c)
          if (c[3] >= 0.999) break
        }
        p = p.parentElement as HTMLElement | null
      }
      // Document root fallback: white
      let acc: [number, number, number] = [1, 1, 1]
      for (let i = stack.length - 1; i >= 0; i--) {
        acc = composite(stack[i]!, acc)
      }
      return acc
    }
    function ratio(fg: [number, number, number], bg: [number, number, number]): number {
      const L1 = relLum(fg)
      const L2 = relLum(bg)
      const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1]
      return (a + 0.05) / (b + 0.05)
    }

    // Find the Danger zone section
    const section = Array.from(document.querySelectorAll("section, div"))
      .find((s) => s.querySelector("h2")?.textContent?.trim() === "Danger zone") as HTMLElement | undefined
    if (!section) throw new Error("Danger zone section not found")

    const targets = [
      { el: section.querySelector("h2") as HTMLElement, label: "H2 'Danger zone'" },
      { el: section.querySelector("p") as HTMLElement, label: "P paragraph" }
    ].filter((t) => t.el)

    return targets.map(({ el, label }) => {
      const fgRaw = parseToSrgb(getComputedStyle(el).color)!
      const bg = effectiveBackground(el)
      const fg: [number, number, number] = fgRaw[3] >= 0.999
        ? [fgRaw[0], fgRaw[1], fgRaw[2]]
        : composite(fgRaw, bg)
      const r = ratio(fg, bg)
      // Apply WCAG 1.4.3 thresholds. Large text = >=18pt regular OR >=14pt bold (>=700).
      // 1pt = 1.333..px, so >=24px regular or >=18.66px bold.
      const sz = parseFloat(getComputedStyle(el).fontSize)
      const wt = parseInt(getComputedStyle(el).fontWeight, 10) || 400
      const isLarge = sz >= 24 || (wt >= 700 && sz >= 18.66)
      const threshold = isLarge ? 3 : 4.5
      return { selectorText: label, ratio: Math.round(r * 100) / 100, threshold }
    })
  })
}

async function forceTheme(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme })
  await page.evaluate((t) => {
    localStorage.setItem("theme", t)
    const html = document.documentElement
    html.classList.remove("light", "dark")
    html.classList.add(t)
    html.style.colorScheme = t
    void html.offsetHeight
  }, theme)
}

/**
 * Three Danger-zone callsites — PageForm (closed by UX-2026-0010 in batch-1),
 * TenantEditForm (UX-2026-0016), UserEditForm (UX-2026-0018). Each takes the
 * same `text-destructive` → `text-foreground` swap; the parameterised test
 * below verifies they all clear AA in BOTH light and dark themes per the
 * methodology Appendix B 2026-05-09 amendment.
 */
const DANGER_ZONE_SURFACES = [
  { url: "/sites/audit-test/pages/1", label: "PageForm", finding: "UX-2026-0010" },
  { url: "/sites/audit-test/edit",    label: "TenantEditForm", finding: "UX-2026-0016" },
  { url: "/users/2/edit",             label: "UserEditForm", finding: "UX-2026-0018" }
] as const

test.describe("Danger-zone color contrast (WCAG 1.4.3 AA, all callsites, both themes)", () => {
  for (const surface of DANGER_ZONE_SURFACES) {
    for (const theme of ["light", "dark"] as const) {
      test(`${surface.finding} (${surface.label}) — ${theme} mode at 375×667`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 })
        await loginAsSuperAdmin(page)
        await page.goto(surface.url)
        await forceTheme(page, theme)
        const samples = await measureDangerZone(page)
        expect(samples.length, `${surface.label} should have a Danger zone`).toBeGreaterThan(0)
        for (const s of samples) {
          expect.soft(
            s.ratio,
            `${surface.label} ${theme} — ${s.selectorText} ratio (threshold ${s.threshold}:1)`
          ).toBeGreaterThanOrEqual(s.threshold)
        }
      })
    }
  }

  test("UX-2026-0010 (PageForm) at desktop viewport — sanity check", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await loginAsSuperAdmin(page)
    await page.goto("/sites/audit-test/pages/1")
    const samples = await measureDangerZone(page)
    for (const s of samples) {
      expect.soft(s.ratio, `${s.selectorText} ratio (threshold ${s.threshold}:1)`).toBeGreaterThanOrEqual(s.threshold)
    }
  })
})

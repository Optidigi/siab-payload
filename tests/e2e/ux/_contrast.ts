import type { Page } from "@playwright/test"

/**
 * Canvas-based WCAG 2.x contrast computation. Used by UX specs that need to
 * measure contrast in CI without depending on axe-core. Mirrors axe's
 * algorithm closely enough for the AA threshold checks the methodology floor
 * requires (4.5:1 normal text, 3:1 large text). Does NOT depend on a runtime-
 * fetched axe bundle — works against any deployed app.
 */

export type ContrastSample = {
  selectorText: string
  ratio: number
  threshold: number
}

/**
 * Force a theme on the running page. Combines `page.emulateMedia` (so
 * `prefers-color-scheme` listeners react), classList flip on <html> (so
 * Tailwind v4's class-based dark variant resolves correctly), an explicit
 * `colorScheme` style, and a forced reflow so subsequent style reads see
 * the just-applied class. The reflow + emulateMedia combo is what makes the
 * helper deterministic under Playwright's `--workers=1` flag.
 */
export async function forceTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  // emulateMedia first so next-themes' "system" default settles BEFORE the
  // class flip; otherwise next-themes' MutationObserver / its own effect can
  // race the classList flip and revert to system. setItem the localStorage
  // value too so any future mount doesn't bounce away from the requested
  // theme. The wait + reflow give React a tick to settle.
  await page.emulateMedia({ colorScheme: theme })
  await page.evaluate((t) => {
    localStorage.setItem("theme", t)
  }, theme)
  // Wait a beat so next-themes' useEffect runs against the seeded media
  // preference + storage value before we force the class.
  await page.waitForTimeout(60)
  await page.evaluate((t) => {
    const html = document.documentElement
    html.classList.remove("light", "dark")
    html.classList.add(t)
    html.style.colorScheme = t
    void html.offsetHeight
  }, theme)
  // One more tick so any subscriber (CSS variable consumers via inline style
  // updates, etc.) has time to reflect the new mode in computed styles.
  await page.waitForTimeout(40)
}

/**
 * Browser-side contrast measurement. Returns one ContrastSample per matched
 * element. The fragment runs entirely in the page context — no external
 * libraries fetched.
 */
export async function measureContrast(
  page: Page,
  selectorOrFinder: string | { js: string }
): Promise<ContrastSample[]> {
  return await page.evaluate(
    ({ selectorOrFinder }: { selectorOrFinder: string | { js: string } }) => {
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
      function relLum([r, g, b]: [number, number, number]): number {
        const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      }
      function composite(over: [number, number, number, number], under: [number, number, number]): [number, number, number] {
        const a = over[3]
        return [over[0] * a + under[0] * (1 - a), over[1] * a + under[1] * (1 - a), over[2] * a + under[2] * (1 - a)]
      }
      function effectiveBackground(el: HTMLElement): [number, number, number] {
        const stack: Array<[number, number, number, number]> = []
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
        let acc: [number, number, number] = [1, 1, 1]
        for (let i = stack.length - 1; i >= 0; i--) {
          acc = composite(stack[i]!, acc)
        }
        return acc
      }
      function ratio(fg: [number, number, number], bg: [number, number, number]): number {
        const L1 = relLum(fg), L2 = relLum(bg)
        const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1]
        return (a + 0.05) / (b + 0.05)
      }
      let nodes: HTMLElement[]
      if (typeof selectorOrFinder === "string") {
        nodes = Array.from(document.querySelectorAll(selectorOrFinder)) as HTMLElement[]
      } else {
        // eslint-disable-next-line no-eval
        const finder = eval(`(${selectorOrFinder.js})`) as () => HTMLElement[]
        nodes = finder()
      }
      return nodes.map((el) => {
        const fgRaw = parseToSrgb(getComputedStyle(el).color)!
        const bg = effectiveBackground(el)
        const fg: [number, number, number] = fgRaw[3] >= 0.999
          ? [fgRaw[0], fgRaw[1], fgRaw[2]]
          : composite(fgRaw, bg)
        const r = ratio(fg, bg)
        const sz = parseFloat(getComputedStyle(el).fontSize)
        const wt = parseInt(getComputedStyle(el).fontWeight, 10) || 400
        const isLarge = sz >= 24 || (wt >= 700 && sz >= 18.66)
        const threshold = isLarge ? 3 : 4.5
        const label = (el.tagName.toLowerCase() +
          (el.id ? "#" + el.id : "") +
          (el.textContent ? ` "${el.textContent.trim().slice(0, 30)}"` : ""))
        return { selectorText: label, ratio: Math.round(r * 100) / 100, threshold }
      })
    },
    { selectorOrFinder }
  )
}

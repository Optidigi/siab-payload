import { describe, it, expect } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"

// Audit finding #14 (P3, T12) — `target="_blank"` without `rel="noopener"` on
// `src/components/onboarding/OnboardingChecklist.tsx:41`. The opened tab can
// navigate the opener via `window.opener` (reverse-tabnabbing). Severity Low
// (internal admin onboarding link, not a public-content vector). Audit
// suggested fix: change `rel="noreferrer"` → `rel="noopener noreferrer"`.
//
// Test surface is intentionally text-level rather than DOM-level: the audit's
// concern is the literal HTML attribute that ships in the rendered admin UI.
// Per the dispatch's sweep mandate, Case 3 is a regression alarm that fires
// if any future PR adds a new `target="_blank"` without the right rel.

const SRC_ROOT = path.resolve(process.cwd(), "src")
const TARGET_FILE = path.resolve(SRC_ROOT, "components/onboarding/OnboardingChecklist.tsx")

const OPEN_BLANK_ATTR = /target=["']_blank["']/

// Match an entire <a ...> opening tag that contains target="_blank". The
// regex tolerates JSX that may span multiple lines and may use either single
// or double quotes around attribute values. Used by both Case 2 and Case 3.
const ANCHOR_WITH_BLANK = /<a\b[^>]*target=["']_blank["'][^>]*>/g

const REL_NOOPENER_NOREFERRER = /rel=["']noopener\s+noreferrer["']/

describe("audit-p3 #14 — target=\"_blank\" anchors carry rel=\"noopener noreferrer\"", () => {
  it("Case 1 — OnboardingChecklist.tsx anchor with target=\"_blank\" has rel set including noopener AND noreferrer", () => {
    const source = fs.readFileSync(TARGET_FILE, "utf-8")
    // Sanity: the file still has the target="_blank" anchor (the audit's
    // referenced line is line 41 — if a refactor moved/removed the anchor,
    // this test alerts).
    expect(source).toMatch(OPEN_BLANK_ATTR)
    // Both noopener AND noreferrer must appear on the SAME anchor as the
    // target="_blank". An anchor that pairs target="_blank" with only
    // rel="noreferrer" (the pre-fix state) MUST fail this assertion.
    const anchors = source.match(ANCHOR_WITH_BLANK) ?? []
    expect(anchors.length, "expected at least one target=\"_blank\" anchor").toBeGreaterThan(0)
    for (const tag of anchors) {
      expect(
        tag,
        `OnboardingChecklist anchor must carry rel=\"noopener noreferrer\": ${tag}`,
      ).toMatch(REL_NOOPENER_NOREFERRER)
    }
  })

  it("Case 2 — exact attribute value: rel attribute is exactly the two tokens \"noopener noreferrer\" (in that order)", () => {
    // The audit's literal text says `rel="noopener noreferrer"`. Modern
    // browsers tolerate either order, but the dispatch specifies the exact
    // value form for consistency with the existing fix at PageForm.tsx:503
    // ("noopener noreferrer"). This pin is binding — a future PR that
    // emits `rel=\"noreferrer noopener\"` (semantically equivalent) would
    // need to also update this test, which is the desired friction point.
    const source = fs.readFileSync(TARGET_FILE, "utf-8")
    const anchors = source.match(ANCHOR_WITH_BLANK) ?? []
    expect(anchors.length).toBeGreaterThan(0)
    for (const tag of anchors) {
      expect(tag).toMatch(/rel="noopener noreferrer"/)
    }
  })

  it("Case 3 — sweep canary: NO file under src/ has target=\"_blank\" missing the right rel attribute", () => {
    // Walks every .ts/.tsx/.js/.jsx under src/, finds every <a ...> opening
    // tag containing target="_blank", and asserts each one also carries
    // rel="noopener noreferrer". A future PR that adds a new offending
    // anchor anywhere in src/ trips this test before review even starts.
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
          walk(full)
          continue
        }
        if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue
        const text = fs.readFileSync(full, "utf-8")
        if (!OPEN_BLANK_ATTR.test(text)) continue
        // Reset regex state — global regex is stateful across exec() calls.
        ANCHOR_WITH_BLANK.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = ANCHOR_WITH_BLANK.exec(text)) !== null) {
          if (!REL_NOOPENER_NOREFERRER.test(match[0])) {
            offenders.push(`${path.relative(SRC_ROOT, full)}: ${match[0].replace(/\s+/g, " ").trim()}`)
          }
        }
      }
    }
    walk(SRC_ROOT)
    expect(
      offenders,
      `Found target="_blank" anchors without rel="noopener noreferrer":\n${offenders.join("\n")}`,
    ).toEqual([])
  })
})

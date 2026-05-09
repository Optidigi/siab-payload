import { describe, it, expect } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import { isPlaygroundEnabled } from "@/lib/graphql/playgroundGate"

// Audit finding #16 (P3, T10) — `graphql-playground` route lacks defense-in-
// depth env gate. Today Payload v3.84.1's `disablePlaygroundInProduction`
// default is `true` (verified at `node_modules/@payloadcms/next/dist/routes/
// graphql/playground.js:9`), so production exposure depends entirely on that
// upstream default. A future config change adding
// `graphQL: { disablePlaygroundInProduction: false }` would silently re-arm
// anonymous schema enumeration. The fix adds an in-repo env-gate as belt-and-
// braces: `NODE_ENV === "production"` AND `ENABLE_GRAPHQL_PLAYGROUND !== "1"`
// → 404 unconditionally, regardless of Payload's defaults.
//
// This finding ALSO closes OBS-3 (graphql-playground iframable) as a side
// effect — disabling the route in production removes the iframable HTML
// surface entirely.

// -----------------------------------------------------------------------------
// Gate logic — pure function, easy to unit-test
// -----------------------------------------------------------------------------

describe("audit-p3 #16 — isPlaygroundEnabled() gate logic", () => {
  it("Case 1 — NODE_ENV !== \"production\" → playground enabled (positive control, dev/test)", () => {
    expect(isPlaygroundEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(true)
    expect(isPlaygroundEnabled({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(true)
    // NODE_ENV unset → not "production" → enabled (matches Payload's own
    // playground.js polarity; the literal check is `!== "production"`).
    expect(isPlaygroundEnabled({} as NodeJS.ProcessEnv)).toBe(true)
  })

  it("Case 2 — NODE_ENV === \"production\" AND ENABLE_GRAPHQL_PLAYGROUND unset → 404 (the production-default path)", () => {
    // The default-deny path. This is the by-far most common production
    // configuration: NODE_ENV is set by the deployment, the opt-in env var
    // is not set, and the playground returns 404 unconditionally.
    expect(isPlaygroundEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(false)
  })

  it("Case 3 — NODE_ENV === \"production\" AND ENABLE_GRAPHQL_PLAYGROUND === \"1\" → playground enabled (operator opt-in)", () => {
    // The audit-acknowledged escape hatch: an operator who explicitly wants
    // the playground in production for debugging can opt in by setting the
    // env var to the literal string "1". Match exactly per the audit's
    // strict-equality contract.
    expect(
      isPlaygroundEnabled({
        NODE_ENV: "production",
        ENABLE_GRAPHQL_PLAYGROUND: "1",
      } as NodeJS.ProcessEnv),
    ).toBe(true)
  })

  it("Case 4 — NODE_ENV === \"production\" AND ENABLE_GRAPHQL_PLAYGROUND === \"0\" → 404 (explicit disable)", () => {
    expect(
      isPlaygroundEnabled({
        NODE_ENV: "production",
        ENABLE_GRAPHQL_PLAYGROUND: "0",
      } as NodeJS.ProcessEnv),
    ).toBe(false)
  })

  it("Case 5 — strict equality: production + truthy-but-not-\"1\" values → 404 (no boolean-coerced parsing)", () => {
    // The dispatch's binding: only the literal string "1" enables. Anything
    // else — even values that "feel truthy" like "true", "yes", " 1 " —
    // returns 404. This forecloses env-var injection / type-confusion
    // hypotheses where an attacker who can influence env (e.g. via
    // misconfigured CI / 12-factor envs) gets the playground turned on by
    // mistake.
    const truthyButNotOne = [
      "true",
      "TRUE",
      "True",
      "yes",
      "y",
      "on",
      "enabled",
      " 1",  // leading whitespace
      "1 ",  // trailing whitespace
      "01",
      "1.0",
      "[object Object]",  // type-confusion smoke
      "null",
      "undefined",
      "",  // empty string, NOT === "1"
    ]
    for (const value of truthyButNotOne) {
      expect(
        isPlaygroundEnabled({
          NODE_ENV: "production",
          ENABLE_GRAPHQL_PLAYGROUND: value,
        } as NodeJS.ProcessEnv),
        `value=${JSON.stringify(value)} must NOT enable playground in production`,
      ).toBe(false)
    }
  })
})

// -----------------------------------------------------------------------------
// Route wiring — verify route.ts uses the gate (smoke-test, no Payload boot)
// -----------------------------------------------------------------------------

describe("audit-p3 #16 — route.ts wires the gate", () => {
  it("route source imports isPlaygroundEnabled and short-circuits to 404 when the gate returns false", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/app/(payload)/api/graphql-playground/route.ts",
      ),
      "utf-8",
    )
    // The route must reference the gate (either by direct import of
    // isPlaygroundEnabled or by inline NODE_ENV/ENABLE_GRAPHQL_PLAYGROUND
    // checks; we pin to the helper so future maintenance isn't tempted to
    // duplicate the logic with subtly different polarity).
    expect(source).toContain("isPlaygroundEnabled")
    // The route must produce a 404 response when disabled. Either via a
    // direct `new Response("Not Found", { status: 404 })` or Next's
    // `notFound()`. Pinning to status: 404 keeps the assertion robust to
    // either form.
    expect(source).toMatch(/status:\s*404/)
  })
})

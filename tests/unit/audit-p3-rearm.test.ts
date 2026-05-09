import { describe, it, expect } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import { Pages } from "@/collections/Pages"

// Audit-p3 batch — re-arm guards. Each prior batch's invariants must remain
// in place after this batch's three sub-fixes land. The exhaustive verification
// is "run every prior batch's test file independently and confirm green"
// (Stage 3 of the dispatch). These ten tests are lightweight, in-process
// invariant pins on the relevant code surfaces — they fire fast as part of
// the regular `pnpm test` and provide a structural alarm if any prior fix's
// surface is removed or renamed unexpectedly during this batch.
//
// They are NOT a replacement for the per-batch suites; they're early-warning
// canaries. R7 / R10 in particular pair the canary with a structural check
// (Pages.beforeValidate hook reference, manifest mutex export) so a "fix
// got refactored away" regression trips immediately.

const SRC = (rel: string) =>
  fs.readFileSync(path.resolve(process.cwd(), rel), "utf-8")

describe("audit-p3 batch — re-arm guards (prior batches stay closed)", () => {
  it("R1 (AMD-1): Users config exposes canCreateUserField and wires it on role/tenants create access", () => {
    const src = SRC("src/collections/Users.ts")
    expect(src).toContain("canCreateUserField")
    // Role and tenants fields each carry create: canCreateUserField. The
    // pattern allows any whitespace; substring match is sufficient.
    expect(src).toMatch(/role[\s\S]*?access:\s*\{\s*create:\s*canCreateUserField/)
    expect(src).toMatch(/tenants[\s\S]*?access:\s*\{\s*create:\s*canCreateUserField/)
  })

  it("R2 (AMD-2): apiKey, enableAPIKey, apiKeyIndex fields all locked to isSuperAdminField on both create and update", () => {
    const src = SRC("src/collections/Users.ts")
    // Each of the three auth fields must declare both create and update
    // access functions as isSuperAdminField.
    for (const fieldName of ["apiKey", "enableAPIKey", "apiKeyIndex"]) {
      expect(
        src,
        `${fieldName} must carry isSuperAdminField on both create and update`,
      ).toMatch(
        new RegExp(
          `name:\\s*"${fieldName}"[\\s\\S]*?access:\\s*\\{[\\s\\S]*?create:\\s*isSuperAdminField[\\s\\S]*?update:\\s*isSuperAdminField`,
        ),
      )
    }
  })

  it("R3 (AMD-3): rejectNonSuperAdminApiKeyWrites hook is wired into Users.hooks.beforeOperation", () => {
    const src = SRC("src/collections/Users.ts")
    expect(src).toContain("rejectNonSuperAdminApiKeyWrites")
    expect(src).toMatch(/beforeOperation:\s*\[[\s\S]*?rejectNonSuperAdminApiKeyWrites/)
  })

  it("R4 (P0 #2/#3): role and tenants fields' update access is isSuperAdminField (no editor/viewer/owner self-promotion)", () => {
    const src = SRC("src/collections/Users.ts")
    // Update on role MUST be isSuperAdminField (the original P0 close).
    expect(src).toMatch(/role[\s\S]*?access:\s*\{[\s\S]*?update:\s*isSuperAdminField/)
    // Same for tenants.
    expect(src).toMatch(/tenants[\s\S]*?access:\s*\{[\s\S]*?update:\s*isSuperAdminField/)
  })

  it("R5 (P1 #5): rate-limit + Forms data 32 KB cap unchanged", () => {
    expect(SRC("src/middleware.ts")).toMatch(/rate-limiter-flexible|RateLimiterMemory/)
    // 32 KB cap (the audit's literal value).
    expect(SRC("src/collections/Forms.ts")).toContain("32_768")
  })

  it("R6 (P1 #7): clearSessionsOnPasswordChange (or equivalent session-rotation) hook still present in Users", () => {
    const src = SRC("src/collections/Users.ts")
    // Per audit P1 #7's fix shape: a hook that empties sessions[] on
    // password change. The exact symbol name from the fix is referenced by
    // the comment block. The check tolerates renames as long as the
    // sessions=[] rotation pattern survives.
    expect(src).toMatch(/sessions\s*=\s*\[\]/)
  })

  it("R7 (P1 #8): Pages collection still has beforeValidate ensureUniqueTenantSlug hook + migration file", () => {
    const beforeValidate = (Pages.hooks?.beforeValidate ?? []) as Array<unknown>
    expect(beforeValidate.length).toBeGreaterThanOrEqual(1)
    // Migration file still exists.
    expect(
      fs.existsSync(
        path.resolve(
          process.cwd(),
          "src/migrations/20260509_pages_tenant_slug_unique.ts",
        ),
      ),
    ).toBe(true)
  })

  it("R8 (P2 #9): LoginForm uses validateNextRedirect (open-redirect closed)", () => {
    const src = SRC("src/components/forms/LoginForm.tsx")
    expect(src).toContain("validateNextRedirect")
  })

  it("R9 (P2 #10/#13): Forms retention + paginated query helper unchanged", () => {
    // P2 #10 fix lives in src/lib/jobs/purgeStaleForms.ts (Forms retention
    // job) — file existence is the structural pin.
    expect(
      fs.existsSync(path.resolve(process.cwd(), "src/lib/jobs/purgeStaleForms.ts")),
    ).toBe(true)
    // P2 #13 fix: findAllPaginated walker + paginated list queries.
    expect(
      fs.existsSync(path.resolve(process.cwd(), "src/lib/queries/paginate.ts")),
    ).toBe(true)
    expect(SRC("src/lib/queries/mediaUsage.ts")).toContain("findAllPaginated")
  })

  it("R10 (P2 #11/#12): site_settings race handler + manifest mutex unchanged", () => {
    expect(SRC("src/lib/queries/settings.ts")).toContain("isUniqueViolation")
    // P2 #12 fix: per-tenant in-process mutex on manifest writes. The
    // implementation references "Mutex" or "withManifestMutex" depending
    // on the final symbol shape — accept either.
    const manifest = SRC("src/lib/projection/manifest.ts")
    expect(manifest).toMatch(/Mutex|withManifestMutex|mutex/i)
  })
})

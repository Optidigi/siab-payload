import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"

// Audit finding #11 (P2, T8) — getOrCreateSiteSettings find-then-create race
// produces duplicate per-tenant singletons.
//
// Two coordinated halves:
//  Half A — application-level: wrap payload.create in try/catch. On unique-
//           violation (the loser of a race), re-fetch by tenant and return the
//           winner's row. Other errors propagate uncaught.
//  Half B — DB-level migration: replace the non-unique `site_settings_tenant_idx`
//           with a UNIQUE INDEX on (tenant_id). Same shape as P1 #8: refuse to
//           apply if duplicates exist; down() throws.
//
// The two halves are required together: the migration is what makes the catch
// reachable in the first place (without UNIQUE, concurrent creates both succeed
// silently — the race is invisible). The application-level catch is what stops
// the loser's caller from seeing a raw Postgres 23505 error.

// Mock the real payload config (fail-fast on missing env in payload.config.ts)
vi.mock("@/payload.config", () => ({ default: {} }))

// Provide a per-test-controllable getPayload that returns a stub whose `find`
// and `create` are vitest mocks. Each test resets the mocks in beforeEach.
const fakeFind = vi.fn()
const fakeCreate = vi.fn()
vi.mock("payload", async () => {
  const actual = await vi.importActual<typeof import("payload")>("payload")
  return {
    ...actual,
    getPayload: vi.fn(async () => ({ find: fakeFind, create: fakeCreate })),
  }
})

import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import * as migration from "@/migrations/20260509_site_settings_tenant_unique"

beforeEach(() => {
  fakeFind.mockReset()
  fakeCreate.mockReset()
})

// Construct a Postgres-shaped unique-violation error. The pg client throws an
// Error with `.code === "23505"` and a message like
// `duplicate key value violates unique constraint "site_settings_tenant_idx"`.
// Payload v3.84.1 has no DuplicateKeyError class (verified in
// node_modules/payload/dist/errors/) — the error propagates raw from db-postgres.
const makeUniqueViolation = (constraint = "site_settings_tenant_idx") => {
  const err: any = new Error(
    `duplicate key value violates unique constraint "${constraint}"`,
  )
  err.code = "23505"
  err.constraint = constraint
  return err
}

// -----------------------------------------------------------------------------
// Half A — application-level race handling in getOrCreateSiteSettings
// -----------------------------------------------------------------------------

describe("audit-p2 #11 Half A — getOrCreateSiteSettings handles unique-violation race", () => {
  it("Case 1 — single call with no existing row → creates and returns", async () => {
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    const created = { id: 1, tenant: 42, siteName: "Untitled" }
    fakeCreate.mockResolvedValueOnce(created)

    const result = await getOrCreateSiteSettings(42)

    expect(result).toEqual(created)
    expect(fakeFind).toHaveBeenCalledTimes(1)
    expect(fakeCreate).toHaveBeenCalledTimes(1)
    // The find query must scope by tenant (per-tenant singleton).
    const findArgs = fakeFind.mock.calls[0]![0]
    expect(findArgs.collection).toBe("site-settings")
    expect(JSON.stringify(findArgs.where)).toContain("42")
  })

  it("Case 2 — single call with existing row → returns existing without re-creating", async () => {
    const existing = { id: 7, tenant: 42, siteName: "Already Set" }
    fakeFind.mockResolvedValueOnce({ docs: [existing], totalDocs: 1 })

    const result = await getOrCreateSiteSettings(42)

    expect(result).toEqual(existing)
    expect(fakeFind).toHaveBeenCalledTimes(1)
    expect(fakeCreate).not.toHaveBeenCalled()
  })

  it("Case 3 — concurrent racing calls both resolve with same row id; only one create succeeds, loser catches and re-fetches", async () => {
    // Both callers' initial `find` returns 0 docs (the race precondition).
    fakeFind
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })

    // Winner's create resolves; loser's create rejects with unique-violation;
    // loser's re-fetch returns the winner's row.
    const winnerRow = { id: 99, tenant: 42, siteName: "Untitled" }
    fakeCreate
      .mockResolvedValueOnce(winnerRow)
      .mockRejectedValueOnce(makeUniqueViolation())

    fakeFind.mockResolvedValueOnce({ docs: [winnerRow], totalDocs: 1 })

    const results = await Promise.all([
      getOrCreateSiteSettings(42),
      getOrCreateSiteSettings(42),
    ])
    const r1 = results[0] as { id: number }
    const r2 = results[1] as { id: number }

    expect(r1.id).toBe(99)
    expect(r2.id).toBe(99)
    // create called exactly twice (both raced); one resolved, one rejected.
    expect(fakeCreate).toHaveBeenCalledTimes(2)
    // find called three times: initial × 2 + loser's re-fetch.
    expect(fakeFind).toHaveBeenCalledTimes(3)
  })

  it("Case 4 — after successful race resolution: only ONE row exists in DB for the tenant (the loser's create did NOT insert a duplicate)", async () => {
    // The DB-level UNIQUE INDEX is what makes this true; the test asserts the
    // application-level catch does NOT mask the violation (e.g. by retrying
    // create instead of re-fetching). The catch must NEVER reach a second
    // payload.create — otherwise the loser slips through.
    fakeFind
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    const winnerRow = { id: 1, tenant: 42, siteName: "Untitled" }
    fakeCreate
      .mockResolvedValueOnce(winnerRow)
      .mockRejectedValueOnce(makeUniqueViolation())
    fakeFind.mockResolvedValueOnce({ docs: [winnerRow], totalDocs: 1 })

    await Promise.all([
      getOrCreateSiteSettings(42),
      getOrCreateSiteSettings(42),
    ])

    // Critical invariant: create was attempted exactly twice, no retries.
    expect(fakeCreate).toHaveBeenCalledTimes(2)
  })

  it("Case 5 — cross-tenant: two tenants, one settings row each — no false unique-violation", async () => {
    // Tenant 42 has no row; tenant 99 has no row. Both create successfully.
    fakeFind
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    fakeCreate
      .mockResolvedValueOnce({ id: 1, tenant: 42 })
      .mockResolvedValueOnce({ id: 2, tenant: 99 })

    const both = await Promise.all([
      getOrCreateSiteSettings(42),
      getOrCreateSiteSettings(99),
    ])
    const r42 = both[0] as { id: number }
    const r99 = both[1] as { id: number }

    expect(r42.id).toBe(1)
    expect(r99.id).toBe(2)
    expect(fakeCreate).toHaveBeenCalledTimes(2)
    // No re-fetch (no error caught) — find called only twice (initial reads).
    expect(fakeFind).toHaveBeenCalledTimes(2)
    // The create calls must each carry the correct tenant id.
    expect(fakeCreate.mock.calls[0]![0].data.tenant).toBe(42)
    expect(fakeCreate.mock.calls[1]![0].data.tenant).toBe(99)
  })

  it("Case 6 — real (non-race) error in create propagates uncaught", async () => {
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    const dbDownErr: any = new Error("ECONNREFUSED 127.0.0.1:5432")
    dbDownErr.code = "ECONNREFUSED"
    fakeCreate.mockRejectedValueOnce(dbDownErr)

    let caught: any = null
    try {
      await getOrCreateSiteSettings(42)
    } catch (e) {
      caught = e
    }

    expect(caught, "non-23505 error must propagate").not.toBeNull()
    expect(caught.code).toBe("ECONNREFUSED")
    // Critical: catch MUST NOT swallow non-unique-violation errors.
    // Re-fetch must NOT have happened on a non-race error.
    expect(fakeFind).toHaveBeenCalledTimes(1)
  })

  it("Case 6b — unique-violation caught BUT re-fetch returns 0 docs → re-throw original error (don't infinite-loop or return undefined)", async () => {
    // Pathological case: create rejects with 23505 (e.g. constraint exists for a
    // different reason — phantom history) but the re-fetch finds nothing. The
    // catch MUST NOT loop or return undefined; it MUST re-throw the original
    // 23505 so the caller knows something is genuinely wrong.
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })
    const violation = makeUniqueViolation()
    fakeCreate.mockRejectedValueOnce(violation)
    fakeFind.mockResolvedValueOnce({ docs: [], totalDocs: 0 })

    let caught: any = null
    try {
      await getOrCreateSiteSettings(42)
    } catch (e) {
      caught = e
    }
    expect(caught, "expected re-throw when re-fetch finds no row").not.toBeNull()
    expect(caught.code).toBe("23505")
    // Initial find + create + re-fetch find = 2 finds, 1 create. NO further calls.
    expect(fakeFind).toHaveBeenCalledTimes(2)
    expect(fakeCreate).toHaveBeenCalledTimes(1)
  })

  it("Case 6c — type confusion: tenantId may be string or number; both must scope correctly to the tenant", async () => {
    // Payload's tenant relationship column is integer; callers may pass either
    // string "42" or number 42 depending on URL/query origin. Both must work
    // and both must produce a where clause that scopes by the tenant.
    fakeFind.mockResolvedValueOnce({ docs: [{ id: 1, tenant: 42 }], totalDocs: 1 })
    await getOrCreateSiteSettings("42")
    const where1 = JSON.stringify(fakeFind.mock.calls[0]![0].where)
    expect(where1).toContain("42")
  })
})

// -----------------------------------------------------------------------------
// Half B — migration shape
// -----------------------------------------------------------------------------

describe("audit-p2 #11 Half B — migration shape", () => {
  it("Case 7 — migration file exports up and down functions", () => {
    expect(typeof migration.up).toBe("function")
    expect(typeof migration.down).toBe("function")
  })

  it("Case 7b — up() source includes duplicate-detection guard before index creation", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/migrations/20260509_site_settings_tenant_unique.ts",
      ),
      "utf-8",
    )
    // Duplicate detection: SELECT ... GROUP BY tenant_id ... HAVING COUNT(*) > 1
    expect(source).toMatch(/SELECT[\s\S]+tenant_id[\s\S]+GROUP BY[\s\S]+HAVING/i)
    // Unique index creation on site_settings (tenant_id)
    expect(source).toMatch(
      /CREATE\s+UNIQUE\s+INDEX[\s\S]+"site_settings_tenant_idx"[\s\S]+\(\s*"tenant_id"\s*\)/,
    )
    // The duplicate-detection SELECT must precede the CREATE UNIQUE INDEX.
    const dupIdx = source.search(/HAVING\s+COUNT\s*\(\s*\*\s*\)/i)
    const idxIdx = source.search(/CREATE\s+UNIQUE\s+INDEX\s+"site_settings_tenant_idx"/)
    expect(dupIdx).toBeGreaterThan(-1)
    expect(idxIdx).toBeGreaterThan(-1)
    expect(dupIdx).toBeLessThan(idxIdx)
  })

  it("Case 7c — up() drops the existing non-unique site_settings_tenant_idx before re-creating it as unique", () => {
    // Postgres won't let two indexes with the same name coexist. The audit
    // notes the existing non-unique index lives at
    // 20260505_172626_initial_schema.ts:377. The new migration must DROP it
    // first (or use a different name; the dispatch picks the same name).
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/migrations/20260509_site_settings_tenant_unique.ts",
      ),
      "utf-8",
    )
    expect(source).toMatch(/DROP\s+INDEX[^;]*site_settings_tenant_idx/i)
  })

  it("Case 8 — down() throws unconditionally", async () => {
    let err: any = null
    try {
      await migration.down({ db: {} as any, payload: {} as any, req: {} as any })
    } catch (e) {
      err = e
    }
    expect(err, "down() must throw").not.toBeNull()
    expect(err).toBeInstanceOf(Error)
    const msg = String(err?.message ?? "")
    // Mention destructive + name the index so an operator who genuinely needs
    // to roll back has the exact identifier.
    expect(msg.toLowerCase()).toContain("destructive")
    expect(msg).toContain("site_settings_tenant_idx")
  })

  it("Migration is wired into src/migrations/index.ts so the runner picks it up", () => {
    const indexSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/migrations/index.ts"),
      "utf-8",
    )
    expect(indexSource).toContain("20260509_site_settings_tenant_unique")
  })
})

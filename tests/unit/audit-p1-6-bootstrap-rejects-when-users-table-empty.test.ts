import { describe, it, expect, afterEach } from "vitest"
import { Users } from "@/collections/Users"

// Audit finding #6 (P1, T2) — Bootstrap re-opens super-admin signup whenever
// the users table is empty. Replace the in-band count-only gate with a
// `BOOTSTRAP_TOKEN` env-var-gated header check, AND reject any incoming
// `role !== "super-admin"` from the bootstrap path. Once any user exists
// and authenticated callers exist, the bootstrap path stays closed even if
// the table is later emptied (operator must rotate BOOTSTRAP_TOKEN to re-arm).
//
// The access function is async; we exercise it directly with a hand-built
// req shape mirroring Payload's AccessArgs ({req, data}) — same pattern as
// audit-p0-2-3-role-tenants-field-access.test.ts and audit-p0-1.

const accessCreate = (Users.access as any).create as (
  args: { req: any; data?: any }
) => boolean | Promise<boolean>

const reqFor = (opts: {
  user?: { id?: number; role: string } | null
  bootstrapHeader?: string | null
  totalDocs?: number
}) => ({
  user: opts.user ?? null,
  headers: {
    get: (k: string) =>
      k.toLowerCase() === "x-bootstrap-token" ? (opts.bootstrapHeader ?? null) : null,
  },
  payload: {
    count: async () => ({ totalDocs: opts.totalDocs ?? 0 }),
  },
})

describe("audit-p1 #6 — bootstrap path requires BOOTSTRAP_TOKEN header + super-admin role", () => {
  const orig = process.env.BOOTSTRAP_TOKEN
  afterEach(() => {
    if (orig === undefined) delete process.env.BOOTSTRAP_TOKEN
    else process.env.BOOTSTRAP_TOKEN = orig
  })

  it("rejects anonymous bootstrap when BOOTSTRAP_TOKEN env var is unset (closes silent re-open on table-empty)", async () => {
    delete process.env.BOOTSTRAP_TOKEN
    const result = await accessCreate({
      req: reqFor({ user: null, totalDocs: 0 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(false)
  })

  it("rejects anonymous bootstrap with wrong header value", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    const result = await accessCreate({
      req: reqFor({ user: null, bootstrapHeader: "wrong", totalDocs: 0 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(false)
  })

  it("rejects anonymous bootstrap when header missing (header set to null)", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    const result = await accessCreate({
      req: reqFor({ user: null, bootstrapHeader: null, totalDocs: 0 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(false)
  })

  it("rejects bootstrap with correct header but role !== 'super-admin' (audit: 'reject any role !== super-admin')", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    for (const role of ["owner", "editor", "viewer", undefined, null, "admin"]) {
      const result = await accessCreate({
        req: reqFor({ user: null, bootstrapHeader: "secret-1234", totalDocs: 0 }),
        data: { role: role as any, email: "a@b", password: "x" },
      })
      expect(result, `role=${String(role)}`).toBe(false)
    }
  })

  it("rejects bootstrap when users already exist (header + role correct)", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    const result = await accessCreate({
      req: reqFor({ user: null, bootstrapHeader: "secret-1234", totalDocs: 3 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(false)
  })

  it("permits bootstrap when env+header+role=super-admin+empty-table all correct", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    const result = await accessCreate({
      req: reqFor({ user: null, bootstrapHeader: "secret-1234", totalDocs: 0 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(true)
  })

  it("super-admin/owner shortcut still permits create regardless of bootstrap state", async () => {
    delete process.env.BOOTSTRAP_TOKEN
    expect(
      await accessCreate({
        req: reqFor({ user: { role: "super-admin" }, totalDocs: 5 }),
        data: { role: "editor" },
      })
    ).toBe(true)
    expect(
      await accessCreate({
        req: reqFor({ user: { role: "owner" }, totalDocs: 5 }),
        data: { role: "editor" },
      })
    ).toBe(true)
  })

  it("editor/viewer authed users are NOT shortcut-permitted (only super-admin/owner)", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    // Editor has no header/role match → fall through to bootstrap path which fails.
    expect(
      await accessCreate({
        req: reqFor({ user: { role: "editor" }, totalDocs: 5 }),
        data: { role: "editor" },
      })
    ).toBe(false)
    expect(
      await accessCreate({
        req: reqFor({ user: { role: "viewer" }, totalDocs: 5 }),
        data: { role: "editor" },
      })
    ).toBe(false)
  })

  it("does NOT issue the DB count when env var is unset (perf + DoS surface; fail closed early)", async () => {
    delete process.env.BOOTSTRAP_TOKEN
    let countCalls = 0
    const req = {
      user: null,
      headers: { get: () => null },
      payload: {
        count: async () => {
          countCalls++
          return { totalDocs: 0 }
        },
      },
    }
    await accessCreate({ req, data: { role: "super-admin" } })
    expect(countCalls).toBe(0)
  })

  it("does NOT issue the DB count when bootstrap header is wrong (fail closed before DB)", async () => {
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    let countCalls = 0
    const req = {
      user: null,
      headers: { get: (k: string) => (k.toLowerCase() === "x-bootstrap-token" ? "wrong" : null) },
      payload: {
        count: async () => {
          countCalls++
          return { totalDocs: 0 }
        },
      },
    }
    await accessCreate({ req, data: { role: "super-admin" } })
    expect(countCalls).toBe(0)
  })

  it("rejects token comparison via length-based truncation (defense-in-depth: timing-safe compare)", async () => {
    // If a naive `===` compare were used with attacker-supplied prefix matching
    // the env var, the only signal an attacker has is the boolean reject. With
    // timing-safe compare on length-mismatched buffers we still want a clean
    // reject — assert behavioral correctness here. (The cryptographic
    // timing-safety is property of crypto.timingSafeEqual itself.)
    process.env.BOOTSTRAP_TOKEN = "secret-1234"
    const result = await accessCreate({
      req: reqFor({ user: null, bootstrapHeader: "secret", totalDocs: 0 }),
      data: { role: "super-admin", email: "a@b", password: "x" },
    })
    expect(result).toBe(false)
  })
})

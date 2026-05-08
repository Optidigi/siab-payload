import { describe, it, expect } from "vitest"
import { Users } from "@/collections/Users"

// Audit finding #2 (P0, T2) — Editor/viewer self-promote to super-admin via PATCH
//                              /api/users/{self} (no field-level access on role).
// Audit finding #3 (P0, T2) — Owner self-promotes to super-admin (same root cause).
//
// Root-cause fix: the `role` and `tenants` fields on the Users collection MUST
// expose a field-level `access.update` that returns true ONLY for super-admin.
// Tenant-scoped roles (owner / editor / viewer) and anonymous callers must be
// blocked from mutating these fields, regardless of whether the row-level
// `canManageUsers` filter selects their own row.
//
// We assert at config-shape level, matching the existing pattern in
// collections-users.test.ts. End-to-end verification against the Postgres
// API would require an `.env` we don't provision in unit-test runs.

const reqFor = (role: string | null, id: string = "u1") =>
  ({ req: { user: role ? { id, role } : null } }) as any

describe("audit-p0 #2/#3 — field-level access blocks role/tenants escalation", () => {
  describe("`role` field", () => {
    const roleField = (Users.fields as any[]).find((f) => f.name === "role")

    it("declares an `access.update` function (field-level update gate)", () => {
      expect(roleField).toBeTruthy()
      expect(roleField.access).toBeTruthy()
      expect(typeof roleField.access.update).toBe("function")
    })

    it("rejects role updates from editor (Finding #2 — self-promote vector)", () => {
      expect(roleField.access.update(reqFor("editor"))).toBe(false)
    })

    it("rejects role updates from viewer (Finding #2 — self-promote vector)", () => {
      expect(roleField.access.update(reqFor("viewer"))).toBe(false)
    })

    it("rejects role updates from owner (Finding #3 — owner self-promote)", () => {
      expect(roleField.access.update(reqFor("owner"))).toBe(false)
    })

    it("rejects role updates from anonymous callers", () => {
      expect(roleField.access.update(reqFor(null))).toBe(false)
    })

    it("permits role updates from super-admin (positive control)", () => {
      expect(roleField.access.update(reqFor("super-admin"))).toBe(true)
    })
  })

  describe("`tenants` field", () => {
    const tenantsField = (Users.fields as any[]).find((f) => f.name === "tenants")

    it("declares an `access.update` function on the array field", () => {
      expect(tenantsField).toBeTruthy()
      expect(tenantsField.access).toBeTruthy()
      expect(typeof tenantsField.access.update).toBe("function")
    })

    it("rejects tenants updates from editor / viewer / owner / anon", () => {
      // Setting `tenants: []` while flipping `role: super-admin` is the precise
      // exploit shape called out in audit Findings #2 and #3 — block it on the
      // tenants side too so neither half of the payload succeeds.
      expect(tenantsField.access.update(reqFor("editor"))).toBe(false)
      expect(tenantsField.access.update(reqFor("viewer"))).toBe(false)
      expect(tenantsField.access.update(reqFor("owner"))).toBe(false)
      expect(tenantsField.access.update(reqFor(null))).toBe(false)
    })

    it("permits tenants updates from super-admin (positive control)", () => {
      expect(tenantsField.access.update(reqFor("super-admin"))).toBe(true)
    })
  })
})

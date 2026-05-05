import { describe, it, expect } from "vitest"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import { isTenantMember } from "@/access/isTenantMember"
import { isOwnerInTenant } from "@/access/isOwnerInTenant"
import { canManageUsers } from "@/access/canManageUsers"

// Fixtures match Payload's actual call shape: access functions receive { req, ... }
// where req contains the authenticated user (or null).
const su = { req: { user: { id: "su1", role: "super-admin", tenant: null } } } as any
const owner = { req: { user: { id: "ow1", role: "owner", tenant: { id: "t1" } } } } as any
const editor = { req: { user: { id: "ed1", role: "editor", tenant: { id: "t1" } } } } as any
const viewer = { req: { user: { id: "vi1", role: "viewer", tenant: { id: "t1" } } } } as any
const anon = { req: { user: null } } as any

describe("isSuperAdmin", () => {
  it("true only for super-admin role", () => {
    expect(isSuperAdmin(su)).toBe(true)
    expect(isSuperAdmin(owner)).toBe(false)
    expect(isSuperAdmin(anon)).toBe(false)
  })
})

describe("isTenantMember", () => {
  it("true for any role with tenant set", () => {
    expect(isTenantMember(owner)).toBe(true)
    expect(isTenantMember(editor)).toBe(true)
    expect(isTenantMember(viewer)).toBe(true)
    expect(isTenantMember(su)).toBe(false)
    expect(isTenantMember(anon)).toBe(false)
  })
})

describe("isOwnerInTenant", () => {
  it("true for owner role", () => {
    expect(isOwnerInTenant(owner)).toBe(true)
    expect(isOwnerInTenant(editor)).toBe(false)
  })
})

describe("canManageUsers — Users collection access", () => {
  it("super-admin can manage anyone", () => {
    expect(canManageUsers(su)).toBe(true)
  })
  it("owner sees only own-tenant users via where filter", () => {
    expect(canManageUsers(owner)).toEqual({ tenant: { equals: "t1" } })
  })
  it("editor/viewer can only manage themselves", () => {
    expect(canManageUsers(editor)).toEqual({ id: { equals: "ed1" } })
    expect(canManageUsers(viewer)).toEqual({ id: { equals: "vi1" } })
  })
  it("anon cannot manage users", () => {
    expect(canManageUsers(anon)).toBe(false)
  })
})

import { describe, it, expect } from "vitest"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import { isTenantMember } from "@/access/isTenantMember"
import { isOwnerInTenant } from "@/access/isOwnerInTenant"
import { canManageUsers } from "@/access/canManageUsers"

const su = { user: { role: "super-admin", tenant: null } } as any
const owner = { user: { role: "owner", tenant: { id: "t1" } } } as any
const editor = { user: { role: "editor", tenant: { id: "t1" } } } as any
const viewer = { user: { role: "viewer", tenant: { id: "t1" } } } as any
const otherOwner = { user: { role: "owner", tenant: { id: "t2" } } } as any
const anon = { user: null } as any

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
    const where = canManageUsers(su)
    expect(where).toBe(true)
  })
  it("owner sees only own-tenant users via where filter", () => {
    const where = canManageUsers(owner)
    expect(where).toEqual({ tenant: { equals: "t1" } })
  })
  it("editor/viewer can only manage themselves", () => {
    const editorWithId = { user: { ...editor.user, id: "u1" } } as any
    const where = canManageUsers(editorWithId)
    expect(where).toEqual({ id: { equals: "u1" } })
  })
  it("anon cannot manage users", () => {
    expect(canManageUsers(anon)).toBe(false)
  })
})

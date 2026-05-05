import { describe, it, expect } from "vitest"
import { Users } from "@/collections/Users"

describe("Users collection config", () => {
  it("uses 'users' slug", () => { expect(Users.slug).toBe("users") })

  it("auth is enabled with API key support", () => {
    expect(Users.auth).toBeTruthy()
    expect((Users.auth as any).useAPIKey).toBe(true)
  })

  it("has role enum with four values", () => {
    const f = Users.fields.find((x: any) => x.name === "role") as any
    expect(f.options.map((o: any) => o.value)).toEqual([
      "super-admin", "owner", "editor", "viewer"
    ])
  })

  it("has tenants array field with a `tenant` relationship row", () => {
    const f = Users.fields.find((x: any) => x.name === "tenants") as any
    expect(f.type).toBe("array")
    const row = f.fields.find((x: any) => x.name === "tenant") as any
    expect(row.type).toBe("relationship")
    expect(row.relationTo).toBe("tenants")
    expect(row.required).toBe(true)
  })

  it("does not have a singular `tenant` field (plugin-native shape uses tenants[])", () => {
    const f = (Users.fields as any[]).find((x: any) => x.name === "tenant")
    expect(f).toBeUndefined()
  })

  it("validates super-admin must have empty tenants[] and others have exactly one", () => {
    const f = Users.fields.find((x: any) => x.name === "tenants") as any
    expect(typeof f.validate).toBe("function")
    // super-admin: empty is OK, any entry is rejected
    expect(f.validate([],                       { siblingData: { role: "super-admin" }, operation: "create" })).toBe(true)
    expect(f.validate([{ tenant: "t1" }],       { siblingData: { role: "super-admin" }, operation: "create" })).toMatch(/super-admin/)
    // editor/owner/viewer: empty rejected, exactly one allowed, more than one rejected
    expect(f.validate([],                       { siblingData: { role: "editor" },      operation: "create" })).toMatch(/exactly one/i)
    expect(f.validate([{ tenant: "t1" }],       { siblingData: { role: "editor" },      operation: "create" })).toBe(true)
    expect(f.validate([{ tenant: "t1" }, { tenant: "t2" }], { siblingData: { role: "editor" }, operation: "create" })).toMatch(/exactly one/i)
  })
})

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

  it("has tenant relationship", () => {
    const f = Users.fields.find((x: any) => x.name === "tenant") as any
    expect(f.relationTo).toBe("tenants")
  })

  it("validates super-admin must have null tenant", () => {
    const f = Users.fields.find((x: any) => x.name === "tenant") as any
    expect(typeof f.validate).toBe("function")
    expect(f.validate(null,  { siblingData: { role: "super-admin" }, operation: "create" })).toBe(true)
    expect(f.validate("ten1",{ siblingData: { role: "super-admin" }, operation: "create" })).toMatch(/super-admin/)
    expect(f.validate(null,  { siblingData: { role: "editor" },      operation: "create" })).toMatch(/required/i)
    expect(f.validate("ten1",{ siblingData: { role: "editor" },      operation: "create" })).toBe(true)
  })
})

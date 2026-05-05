import { describe, it, expect } from "vitest"
import { Tenants } from "@/collections/Tenants"

describe("Tenants collection config", () => {
  it("uses 'tenants' slug", () => { expect(Tenants.slug).toBe("tenants") })

  it("has unique domain field", () => {
    const f = Tenants.fields.find((x: any) => x.name === "domain")
    expect(f).toBeDefined()
    expect((f as any).unique).toBe(true)
    expect((f as any).required).toBe(true)
  })

  it("has unique slug field", () => {
    const f = Tenants.fields.find((x: any) => x.name === "slug")
    expect(f).toBeDefined()
    expect((f as any).unique).toBe(true)
  })

  it("status defaults to provisioning", () => {
    const f = Tenants.fields.find((x: any) => x.name === "status") as any
    expect(f.defaultValue).toBe("provisioning")
    expect(f.options.map((o: any) => o.value)).toEqual([
      "provisioning", "active", "suspended", "archived"
    ])
  })
})

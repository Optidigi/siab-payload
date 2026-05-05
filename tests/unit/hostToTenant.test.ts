import { describe, it, expect } from "vitest"
import { stripAdminPrefix, isSuperAdminDomain } from "@/lib/hostToTenant"

describe("stripAdminPrefix", () => {
  it("removes admin. prefix", () => {
    expect(stripAdminPrefix("admin.clientasite.nl")).toBe("clientasite.nl")
  })
  it("removes admin. and port", () => {
    expect(stripAdminPrefix("admin.clientasite.nl:3000")).toBe("clientasite.nl")
  })
  it("returns input unchanged when no admin. prefix", () => {
    expect(stripAdminPrefix("clientasite.nl")).toBe("clientasite.nl")
  })
  it("handles localhost", () => {
    expect(stripAdminPrefix("admin.localhost:3000")).toBe("localhost")
  })
})

describe("isSuperAdminDomain", () => {
  it("matches NEXT_PUBLIC_SUPER_ADMIN_DOMAIN", () => {
    expect(isSuperAdminDomain("siteinabox.nl", "siteinabox.nl")).toBe(true)
    expect(isSuperAdminDomain("clientasite.nl", "siteinabox.nl")).toBe(false)
  })
  it("dev fallback: any 'localhost' is super-admin if env not set", () => {
    expect(isSuperAdminDomain("localhost", undefined)).toBe(true)
  })
})

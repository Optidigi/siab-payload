import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import { getTestPayload, resetTestData } from "./_helpers"
import type { Payload } from "payload"

let payload: Payload
beforeAll(async () => { payload = await getTestPayload() }, 30000)
beforeEach(async () => { await resetTestData(payload) }, 30000)

describe("orchestrator API flow", () => {
  it("API-key user can create a tenant and a scoped page", async () => {
    const orchestrator = await payload.create({
      collection: "users", overrideAccess: true,
      data: {
        email: "orch@test.local", password: "test1234", name: "Orchestrator",
        role: "super-admin", enableAPIKey: true,
        apiKey: "test-api-key-12345678901234567890"
      } as any
    })

    const tenant = await payload.create({
      collection: "tenants", user: orchestrator,
      data: { name: "Client X", slug: "clientx", domain: "clientx.test", status: "provisioning" }
    } as any)
    expect(tenant.id).toBeTruthy()

    // Page seed (must include tenant explicitly because super-admin writes aren't auto-scoped)
    const page = await payload.create({
      collection: "pages", user: orchestrator,
      data: {
        tenant: tenant.id, title: "Home", slug: "home", status: "published",
        blocks: [{ blockType: "hero", headline: "Welcome" }]
      }
    } as any)
    expect(page.id).toBeTruthy()
    const pageTenant = (page as any).tenant
    const tenantId = typeof pageTenant === "object" ? pageTenant.id : pageTenant
    expect(tenantId).toBe(tenant.id)
  })
})

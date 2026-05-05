import { describe, it, expect, beforeAll } from "vitest"
import { getTestPayload, resetTestData, seedFixture } from "./_helpers"
import type { Payload } from "payload"

let payload: Payload

beforeAll(async () => {
  payload = await getTestPayload()
  await resetTestData(payload)
}, 30000)

describe("integration smoke", () => {
  it("can boot Payload + write/read a tenant", async () => {
    const fx = await seedFixture(payload)
    expect(fx.t1.id).toBeTruthy()
    expect(fx.t2.id).toBeTruthy()
    const found = await payload.find({ collection: "tenants", overrideAccess: true })
    expect(found.docs.length).toBe(2)
  })
})

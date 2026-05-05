import { getPayload, type Payload } from "payload"
import config from "@/payload.config"

let cachedPayload: Payload | null = null

export async function getTestPayload(): Promise<Payload> {
  if (!cachedPayload) cachedPayload = await getPayload({ config })
  return cachedPayload
}

export async function resetTestData(payload: Payload) {
  // Wipe collections in dependency order to satisfy FKs.
  // Forms first (FK to tenant), then pages, media, site-settings, then users
  // (which can reference tenant), then tenants last.
  for (const slug of ["forms", "pages", "media", "site-settings", "users", "tenants"] as const) {
    const docs = await payload.find({ collection: slug, limit: 1000, overrideAccess: true })
    for (const d of docs.docs) {
      await payload.delete({ collection: slug, id: (d as any).id, overrideAccess: true })
    }
  }
}

export async function seedFixture(payload: Payload) {
  const t1 = await payload.create({
    collection: "tenants",
    data: { name: "Tenant 1", slug: "t1", domain: "t1.test", status: "active" },
    overrideAccess: true
  })
  const t2 = await payload.create({
    collection: "tenants",
    data: { name: "Tenant 2", slug: "t2", domain: "t2.test", status: "active" },
    overrideAccess: true
  })

  const sa = await payload.create({
    collection: "users",
    data: { email: "sa@test.local", password: "test1234", name: "SA", role: "super-admin" } as any,
    overrideAccess: true
  })
  const owner1 = await payload.create({
    collection: "users",
    data: { email: "owner1@test.local", password: "test1234", name: "Owner1", role: "owner", tenants: [{ tenant: t1.id }] } as any,
    overrideAccess: true
  })
  const editor1 = await payload.create({
    collection: "users",
    data: { email: "editor1@test.local", password: "test1234", name: "Editor1", role: "editor", tenants: [{ tenant: t1.id }] } as any,
    overrideAccess: true
  })
  const viewer1 = await payload.create({
    collection: "users",
    data: { email: "viewer1@test.local", password: "test1234", name: "Viewer1", role: "viewer", tenants: [{ tenant: t1.id }] } as any,
    overrideAccess: true
  })
  const owner2 = await payload.create({
    collection: "users",
    data: { email: "owner2@test.local", password: "test1234", name: "Owner2", role: "owner", tenants: [{ tenant: t2.id }] } as any,
    overrideAccess: true
  })

  return { t1, t2, sa, owner1, editor1, viewer1, owner2 }
}

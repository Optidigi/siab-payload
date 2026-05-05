import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function listTenants() {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: "tenants",
    overrideAccess: true,
    limit: 200,
    sort: "-updatedAt"
  })
  return res.docs
}

export async function getTenantBySlug(slug: string) {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: "tenants",
    overrideAccess: true,
    where: { slug: { equals: slug } },
    limit: 1
  })
  return res.docs[0] ?? null
}

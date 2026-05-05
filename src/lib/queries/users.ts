import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function listUsersForTenant(tenantId: number | string) {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: "users",
    overrideAccess: true,
    where: { "tenants.tenant": { equals: tenantId } } as any,
    limit: 200
  })
  return res.docs
}

export async function listAllUsers() {
  const payload = await getPayload({ config })
  const res = await payload.find({ collection: "users", overrideAccess: true, limit: 500 })
  return res.docs
}

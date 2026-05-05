import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function listPages(tenantId: number | string) {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: "pages",
    overrideAccess: true,
    where: { tenant: { equals: tenantId } },
    limit: 500,
    sort: "-updatedAt",
    depth: 1
  })
  return res.docs
}

export async function getPageById(id: number | string) {
  const payload = await getPayload({ config })
  return payload.findByID({ collection: "pages", id, overrideAccess: true, depth: 2 })
}

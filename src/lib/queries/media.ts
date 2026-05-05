import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function listMedia(tenantId: number | string) {
  const payload = await getPayload({ config })
  return payload.find({
    collection: "media",
    overrideAccess: true,
    where: { tenant: { equals: tenantId } },
    limit: 500,
    sort: "-updatedAt"
  })
}

export async function deleteMedia(id: number | string) {
  const payload = await getPayload({ config })
  return payload.delete({ collection: "media", id, overrideAccess: true })
}

import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function listForms(tenantId: number | string, status?: string) {
  const payload = await getPayload({ config })
  const where: any = { tenant: { equals: tenantId } }
  if (status) where.status = { equals: status }
  return payload.find({
    collection: "forms",
    overrideAccess: true,
    where,
    limit: 500,
    sort: "-createdAt"
  })
}

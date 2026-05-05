import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

export async function getOrCreateSiteSettings(tenantId: number | string) {
  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: "site-settings",
    overrideAccess: true,
    where: { tenant: { equals: tenantId } },
    limit: 1
  })
  if (found.docs.length) return found.docs[0]
  return payload.create({
    collection: "site-settings",
    overrideAccess: true,
    data: { tenant: tenantId, siteName: "Untitled", siteUrl: "https://example.com" } as any
  })
}

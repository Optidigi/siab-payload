import "server-only"
import { cache } from "react"
import { getPayload } from "payload"
import config from "@/payload.config"
import { buildMediaUsageMap } from "./mediaUsageWalker"
import type { MediaUsageMap } from "./mediaUsageWalker"
import type { SiteSetting } from "@/payload-types"

export type { MediaPageRef, MediaUsageEntry, MediaUsageMap } from "./mediaUsageWalker"
export { buildMediaUsageMap } from "./mediaUsageWalker"

/**
 * Server helper: fetch a tenant's pages + settings, then walk them to
 * produce the usage map. Wrapped in React.cache() so multiple components
 * within the same RSC request share one DB roundtrip.
 *
 * The walking logic itself lives in `./mediaUsageWalker.ts` (no
 * server-only side effects) so unit tests can import it cleanly.
 */
export const getMediaUsage = cache(async (tenantId: number | string): Promise<MediaUsageMap> => {
  const payload = await getPayload({ config })
  const [pagesRes, settingsRes] = await Promise.all([
    payload.find({
      collection: "pages",
      overrideAccess: true,
      where: { tenant: { equals: tenantId } },
      limit: 500,
      depth: 1
    }),
    payload.find({
      collection: "site-settings",
      overrideAccess: true,
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 1
    })
  ])

  const settings = (settingsRes.docs[0] as Pick<SiteSetting, "branding"> | undefined) ?? null
  return buildMediaUsageMap(pagesRes.docs as any, settings)
})

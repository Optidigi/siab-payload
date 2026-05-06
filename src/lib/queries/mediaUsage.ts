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
 * produce the usage map. Wrapped in React.cache() — request-scoped, so
 * multiple components within the same RSC render share one DB roundtrip.
 * Do NOT memoize at module scope (it would leak across users/requests).
 *
 * The walking logic itself lives in `./mediaUsageWalker.ts` (no
 * server-only side effects) so unit tests can import it cleanly.
 *
 * Upper bound: queries with `limit: 500` per tenant. Real-world tenant
 * page counts are well under this today; if a tenant ever exceeds 500
 * pages, references on overflow pages would silently drop from the
 * usage map. TODO: paginate or assert when totalDocs > 500.
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

  if (pagesRes.totalDocs > 500 && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      `[mediaUsage] tenant ${tenantId} has ${pagesRes.totalDocs} pages — usage map only walks the first 500. Paginate.`
    )
  }

  const settings = (settingsRes.docs[0] as Pick<SiteSetting, "branding"> | undefined) ?? null
  return buildMediaUsageMap(pagesRes.docs as any, settings)
})

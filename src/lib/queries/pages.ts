import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"
import {
  normalisePagination,
  type PayloadFindResult,
  type PayloadLikeFindClient,
} from "./paginate"

// Audit-p2 #13 (T10/T8) — listing queries no longer use a hardcoded
// `limit: 500`. The legacy `listPages(tenantId)` is preserved for the
// existing admin pages (which render at most one screen of recently-
// updated pages); it now caps at DEFAULT_PAGE_SIZE silently. New
// `listPagesPaginated` accepts page+pageSize and returns Payload's full
// result shape so a future UI can wire pagination controls.

export interface ListOpts {
  page?: number
  pageSize?: number
}

/**
 * Tenant-scoped pages listing. Returns the full Payload find result
 * (`{ docs, totalDocs, totalPages, page, hasNextPage, hasPrevPage, ... }`)
 * so the UI can render pagination controls.
 *
 * The third `payload` arg is for unit-test injection only — production
 * call sites omit it and the function resolves the singleton via
 * `getPayload({ config })`.
 */
export async function listPagesPaginated(
  tenantId: number | string,
  opts?: ListOpts,
  payload?: PayloadLikeFindClient,
): Promise<PayloadFindResult> {
  const client = payload ?? ((await getPayload({ config })) as unknown as PayloadLikeFindClient)
  const { page, limit } = normalisePagination(opts)
  return client.find({
    collection: "pages",
    overrideAccess: true,
    where: { tenant: { equals: tenantId } },
    sort: "-updatedAt",
    depth: 1,
    page,
    limit,
  })
}

/**
 * Legacy single-page listing — preserved for callers that don't yet
 * render pagination UI. Delegates to listPagesPaginated and returns
 * just `docs`. Returns at most DEFAULT_PAGE_SIZE rows; older code that
 * expected up-to-500 should migrate to listPagesPaginated.
 */
export async function listPages(tenantId: number | string) {
  const res = await listPagesPaginated(tenantId)
  return res.docs
}

export async function getPageById(id: number | string) {
  const payload = await getPayload({ config })
  return payload.findByID({ collection: "pages", id, overrideAccess: true, depth: 2 })
}

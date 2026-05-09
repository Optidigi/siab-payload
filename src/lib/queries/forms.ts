import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"
import {
  normalisePagination,
  type PayloadFindResult,
  type PayloadLikeFindClient,
} from "./paginate"

// Audit-p2 #13 (T10/T8) — see ./pages.ts for the rationale.

export interface ListFormsOpts {
  page?: number
  pageSize?: number
  status?: string
}

export async function listFormsPaginated(
  tenantId: number | string,
  opts?: ListFormsOpts,
  payload?: PayloadLikeFindClient,
): Promise<PayloadFindResult> {
  const client = payload ?? ((await getPayload({ config })) as unknown as PayloadLikeFindClient)
  const { page, limit } = normalisePagination(opts)
  const where: Record<string, unknown> = { tenant: { equals: tenantId } }
  if (opts?.status) where.status = { equals: opts.status }
  return client.find({
    collection: "forms",
    overrideAccess: true,
    where,
    sort: "-createdAt",
    page,
    limit,
  })
}

/**
 * Legacy single-page listing — see comment in ./pages.ts on listPages.
 * Returns the full result for back-compat with the existing admin
 * FormsTable consumer (which expects a `.docs` array on the value).
 */
export async function listForms(tenantId: number | string, status?: string) {
  return listFormsPaginated(tenantId, status ? { status } : undefined)
}

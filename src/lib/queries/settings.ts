import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

// Audit finding #11 (P2, T8) — find-then-create race resolution.
//
// Two-half fix paired with migration `20260509_site_settings_tenant_unique`
// (UNIQUE INDEX on site_settings.tenant_id). With the unique constraint,
// the loser of a concurrent first-load race no longer silently inserts a
// duplicate row — its `payload.create` rejects with Postgres SQLSTATE 23505.
// This catch translates that into a re-fetch so the loser's caller observes
// the winner's row instead of a raw 23505 error.
//
// Detection by both `.code === "23505"` AND a message regex is intentional
// defense-in-depth: pg propagates the code, but a future Payload version
// might wrap or rename the error. The two-channel check survives either.
const isUniqueViolation = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false
  const e = err as { code?: unknown; message?: unknown }
  if (e.code === "23505") return true
  if (typeof e.message === "string" && /duplicate key value violates unique constraint/i.test(e.message)) {
    return true
  }
  return false
}

export async function getOrCreateSiteSettings(tenantId: number | string) {
  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: "site-settings",
    overrideAccess: true,
    where: { tenant: { equals: tenantId } },
    limit: 1
  })
  if (found.docs.length) return found.docs[0]
  try {
    return await payload.create({
      collection: "site-settings",
      overrideAccess: true,
      data: { tenant: tenantId, siteName: "Untitled", siteUrl: "https://example.com" } as any
    })
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    // Lost the race. The winner inserted a row for this tenant; re-fetch.
    const refetched = await payload.find({
      collection: "site-settings",
      overrideAccess: true,
      where: { tenant: { equals: tenantId } },
      limit: 1
    })
    // If the re-fetch returns 0, the unique-violation came from somewhere
    // other than our race (e.g. a phantom constraint). Re-throw the original
    // error so the caller learns something genuinely unexpected happened —
    // never an infinite retry loop, never a silent undefined return.
    if (!refetched.docs.length) throw err
    return refetched.docs[0]
  }
}

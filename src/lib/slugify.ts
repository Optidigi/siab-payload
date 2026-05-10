/**
 * FN-2026-0042 — auto-derive slug from a Name/Title when the user hasn't
 * manually typed in Slug yet. Used by TenantForm + PageForm new-page
 * surfaces.
 *
 * Lowercase ASCII letters/digits, hyphen-separated. Strips diacritics
 * via NFKD + filter, collapses runs of separators, trims leading/
 * trailing hyphens. Matches the SLUG_REGEX in the Tenants/Pages
 * collections (`/^[a-z0-9-]+$/`) so the result always passes server
 * validation when the input is non-empty.
 */
export function slugify(input: string): string {
  if (!input) return ""
  return input
    .normalize("NFKD")
    // strip combining diacritics
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // any non-[a-z0-9] becomes a hyphen
    .replace(/[^a-z0-9]+/g, "-")
    // collapse multiple hyphens
    .replace(/-+/g, "-")
    // trim leading/trailing hyphens
    .replace(/^-|-$/g, "")
}

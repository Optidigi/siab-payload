type Json = Record<string, any>

/**
 * Keys whose array values contain Payload-array-row objects (each with a
 * Payload-assigned `id` we need to strip from the projected JSON).
 *
 * `blocks` is the top-level Pages.blocks; the rest are nested array fields
 * inside individual block types. Listed explicitly so we don't accidentally
 * strip ids from populated relationship objects (a Media object should keep
 * its id — that's the reference the runtime needs).
 *
 * Add to this list when introducing a new array field on a block.
 */
const ARRAY_ROW_KEYS = new Set([
  "blocks",        // Pages.blocks
  "items",         // Testimonials.items, FAQ.items
  "features",      // FeatureList.features
  "fields",        // ContactSection.fields
  "navigation",    // SiteSettings.navigation (used by settingsToJson, but
                   // also future-proofs pages should they ever embed it)
  "social"         // SiteSettings.contact.social (same)
])

const flattenMedia = (m: any): Json | null => {
  if (!m) return null
  if (typeof m === "string" || typeof m === "number") return { id: m }
  return { url: m.url, filename: m.filename, alt: m.alt, width: m.width, height: m.height }
}

const isMediaShape = (v: any): boolean =>
  v && typeof v === "object" && "url" in v && "filename" in v

/**
 * Recursive projector. Walks the tree and:
 *   - flattens populated Media relationships to {url, filename, alt, w, h}
 *   - strips `id` on every object that lives inside an `ARRAY_ROW_KEYS`-named
 *     array (Payload's array-row id is a DB artifact, not domain data)
 *   - drops `blockName` when it's null/undefined (Payload sets it to null
 *     when unset in the admin form; that null leaks into JSON noisily)
 */
const projectField = (v: any, parentArrayKey?: string): any => {
  if (v == null) return v
  if (Array.isArray(v)) return v.map((item) => projectField(item, parentArrayKey))
  if (typeof v === "object") {
    if (isMediaShape(v)) return flattenMedia(v)

    const insideArrayRow = parentArrayKey && ARRAY_ROW_KEYS.has(parentArrayKey)
    const out: Json = {}
    for (const [k, val] of Object.entries(v)) {
      // Strip the Payload-assigned id on rows inside known array fields.
      if (insideArrayRow && k === "id") continue
      // Drop null/undefined/empty blockName. Payload's admin sets it to null
      // when blank; some UI versions emit "" instead. Either way the consumer
      // doesn't want to ship a no-op blockName.
      if (k === "blockName" && (val == null || val === "")) continue
      // Recurse. When the value IS the named array (e.g. blocks: [...]),
      // pass `k` so children know they're inside an array-row.
      out[k] = projectField(val, ARRAY_ROW_KEYS.has(k) ? k : undefined)
    }
    return out
  }
  return v
}

export function pageToJson(doc: Json): Json {
  return {
    title: doc.title,
    slug: doc.slug,
    blocks: ((doc.blocks ?? []) as Json[]).map((b) => projectField(b, "blocks")),
    seo: doc.seo ? projectField(doc.seo) : undefined,
    updatedAt: doc.updatedAt
  }
}

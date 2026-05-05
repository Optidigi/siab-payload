type Json = Record<string, any>

const stripBlockIds = (b: any): Json => {
  const { id, ...rest } = b
  return rest
}

const flattenMedia = (m: any): Json | null => {
  if (!m) return null
  if (typeof m === "string" || typeof m === "number") return { id: m }
  return { url: m.url, filename: m.filename, alt: m.alt, width: m.width, height: m.height }
}

const projectField = (v: any): any => {
  if (v == null) return v
  if (Array.isArray(v)) return v.map(projectField)
  if (typeof v === "object") {
    if ("url" in v && "filename" in v) return flattenMedia(v)
    const out: Json = {}
    for (const [k, val] of Object.entries(v)) out[k] = projectField(val)
    return out
  }
  return v
}

export function pageToJson(doc: Json): Json {
  return {
    title: doc.title,
    slug: doc.slug,
    blocks: (doc.blocks ?? []).map(stripBlockIds).map(projectField),
    seo: doc.seo ? projectField(doc.seo) : undefined,
    updatedAt: doc.updatedAt
  }
}

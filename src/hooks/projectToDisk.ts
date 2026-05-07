import path from "node:path"
import { promises as fs } from "node:fs"
import type { CollectionAfterChangeHook } from "payload"
import { writeAtomic } from "@/lib/atomicWrite"
import { pageToJson } from "@/lib/projection/pageToJson"
import { settingsToJson } from "@/lib/projection/settingsToJson"
import { readManifest, writeManifest, upsertEntry, removeEntry } from "@/lib/projection/manifest"

const dataDir = () => path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

const tenantIdOf = (doc: any): string | undefined => {
  const t = doc.tenant
  if (t == null) return undefined
  if (typeof t === "object") return String(t.id)
  return String(t)
}

export const projectPageToDisk: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId) return doc
  const tenantDir = path.join(dataDir(), "tenants", tenantId)

  const wasPublished = previousDoc?.status === "published"
  const isPublished = doc.status === "published"
  const slug = doc.slug as string

  if (isPublished) {
    const json = pageToJson(doc)
    await writeAtomic(path.join(tenantDir, "pages", `${slug}.json`), JSON.stringify(json, null, 2))
    let m = await readManifest(dataDir(), tenantId)
    m = upsertEntry(m, { type: "page", key: slug, updatedAt: doc.updatedAt as string })
    await writeManifest(dataDir(), m)
    req.payload.logger.info({ tenantId, slug }, "[projection] page published to disk")
  } else if (wasPublished) {
    const oldSlug = (previousDoc?.slug || slug) as string
    const target = path.join(tenantDir, "pages", `${oldSlug}.json`)
    await fs.rm(target, { force: true })
    let m = await readManifest(dataDir(), tenantId)
    m = removeEntry(m, "page", oldSlug)
    await writeManifest(dataDir(), m)
    req.payload.logger.info({ tenantId, slug: oldSlug }, "[projection] page unpublished — file removed")
  }

  return doc
}

export const projectSettingsToDisk: CollectionAfterChangeHook = async ({ doc, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId) return doc
  const tenantDir = path.join(dataDir(), "tenants", tenantId)
  await writeAtomic(path.join(tenantDir, "site.json"), JSON.stringify(settingsToJson(doc), null, 2))
  let m = await readManifest(dataDir(), tenantId)
  m = upsertEntry(m, { type: "settings", key: "site", updatedAt: doc.updatedAt as string })
  await writeManifest(dataDir(), m)
  req.payload.logger.info({ tenantId }, "[projection] site settings projected")
  return doc
}

export const projectMediaToDisk: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId || !doc.filename) return doc

  const tenantMediaDir = path.join(dataDir(), "tenants", tenantId, "media")
  await fs.mkdir(tenantMediaDir, { recursive: true })

  // Project the uploaded file from Payload's staticDir (`_uploads-tmp/`)
  // to the per-tenant dir on create/update.
  //
  // We COPY (not rename/move) so the file remains in `_uploads-tmp/`
  // — that's Payload's staticDir, and `m.url` resolves to
  // `/api/media/file/<filename>` which Payload serves from staticDir.
  // The earlier `rename` left admin-side thumbnails permanently broken
  // (file gone from staticDir, 404). Per-tenant copy is for the tenant
  // Astro frontends that read directly from disk.
  //
  // Skip silently if the staging file isn't there (metadata-only update,
  // or a re-projection of an already-projected file where the source
  // copy may have been cleaned up out of band).
  const staging = path.join(dataDir(), "_uploads-tmp", doc.filename as string)
  const final = path.join(tenantMediaDir, doc.filename as string)
  if (operation === "create" || operation === "update") {
    try {
      await fs.access(staging)
      await fs.copyFile(staging, final)
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        req.payload.logger.warn({ err, tenantId, filename: doc.filename }, "[projection] media copy failed")
      }
    }
  }

  let m = await readManifest(dataDir(), tenantId)
  m = upsertEntry(m, { type: "media", key: doc.filename as string, updatedAt: doc.updatedAt as string })
  await writeManifest(dataDir(), m)
  return doc
}

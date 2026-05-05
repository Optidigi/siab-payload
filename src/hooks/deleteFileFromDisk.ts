import path from "node:path"
import { promises as fs } from "node:fs"
import type { CollectionAfterDeleteHook } from "payload"
import { readManifest, writeManifest, removeEntry } from "@/lib/projection/manifest"

const dataDir = () => path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

const tenantIdOf = (doc: any): string | undefined => {
  const t = doc.tenant
  if (t == null) return undefined
  if (typeof t === "object") return String(t.id)
  return String(t)
}

export const deletePageFile: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId) return
  const slug = doc.slug as string
  if (!slug) return
  const file = path.join(dataDir(), "tenants", tenantId, "pages", `${slug}.json`)
  await fs.rm(file, { force: true })
  let m = await readManifest(dataDir(), tenantId)
  m = removeEntry(m, "page", slug)
  await writeManifest(dataDir(), m)
  req.payload.logger.info({ tenantId, slug }, "[projection] page deleted from disk")
}

export const deleteMediaFile: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const tenantId = tenantIdOf(doc)
  if (!tenantId || !doc.filename) return
  const filename = doc.filename as string
  const file = path.join(dataDir(), "tenants", tenantId, "media", filename)
  await fs.rm(file, { force: true })
  let m = await readManifest(dataDir(), tenantId)
  m = removeEntry(m, "media", filename)
  await writeManifest(dataDir(), m)
  req.payload.logger.info({ tenantId, filename }, "[projection] media deleted from disk")
}

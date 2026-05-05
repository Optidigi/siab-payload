import path from "node:path"
import { promises as fs } from "node:fs"
import type { CollectionAfterChangeHook } from "payload"
import { writeAtomic } from "@/lib/atomicWrite"

const dataDir = () => path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

export const createTenantDir: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== "create") return doc
  const id = String(doc.id)
  const dir = path.join(dataDir(), "tenants", id)
  await fs.mkdir(path.join(dir, "pages"), { recursive: true })
  await fs.mkdir(path.join(dir, "media"), { recursive: true })
  await writeAtomic(path.join(dir, "manifest.json"), JSON.stringify({
    tenantId: id, version: 0, updatedAt: new Date().toISOString(), entries: []
  }, null, 2))
  req.payload.logger.info({ tenantId: id }, "[tenants] data dir created")
  return doc
}

export const archiveTenantDir: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const wasArchived = previousDoc?.status === "archived"
  const isArchived = doc.status === "archived"
  if (!isArchived || wasArchived) return doc
  const id = String(doc.id)
  const live = path.join(dataDir(), "tenants", id)
  const archived = path.join(dataDir(), "archived", id)
  await fs.mkdir(path.dirname(archived), { recursive: true })
  try {
    await fs.rename(live, archived)
    req.payload.logger.info({ tenantId: id }, "[tenants] data dir archived")
  } catch (err: any) {
    if (err?.code !== "ENOENT") throw err
    req.payload.logger.warn({ tenantId: id }, "[tenants] archive: live dir missing (already archived?)")
  }
  return doc
}

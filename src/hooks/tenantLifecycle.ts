import path from "node:path"
import { promises as fs } from "node:fs"
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from "payload"
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

/**
 * Inverse of `archiveTenantDir`: when a tenant flips from `archived` back to
 * any non-archived status, restore `archived/<id>/` to `tenants/<id>/`.
 * Without this, the dir stays under `archived/` and the new "active" tenant
 * has no projection target — pages re-published after un-archive would 404.
 */
export const restoreTenantDir: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const wasArchived = previousDoc?.status === "archived"
  const isArchived = doc.status === "archived"
  if (!wasArchived || isArchived) return doc
  const id = String(doc.id)
  const archived = path.join(dataDir(), "archived", id)
  const live = path.join(dataDir(), "tenants", id)
  await fs.mkdir(path.dirname(live), { recursive: true })
  try {
    await fs.rename(archived, live)
    req.payload.logger.info({ tenantId: id }, "[tenants] data dir restored from archive")
  } catch (err: any) {
    // Source dir gone (e.g., manually purged). Don't fail the status update —
    // the tenant is conceptually re-activated even without on-disk content.
    if (err?.code !== "ENOENT") throw err
    req.payload.logger.warn({ tenantId: id }, "[tenants] restore: archived dir missing (manually purged?)")
  }
  return doc
}

/**
 * After a tenant is deleted, sweep its on-disk data. FK CASCADE
 * (cascade_tenant_delete migration) handles the document side; this clears
 * the live dir AND any prior archive of the same id, so re-creating a tenant
 * with the same id later doesn't pick up stale files.
 *
 * Failures are logged but do not propagate — the DB delete already
 * committed, and a leftover dir is operator-cleanable, not a hard error.
 */
export const removeTenantDir: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const id = String(doc.id)
  const live = path.join(dataDir(), "tenants", id)
  const archived = path.join(dataDir(), "archived", id)
  try {
    await fs.rm(live, { recursive: true, force: true })
    await fs.rm(archived, { recursive: true, force: true })
    req.payload.logger.info({ tenantId: id }, "[tenants] data dirs removed after delete")
  } catch (err) {
    req.payload.logger.warn({ err, tenantId: id }, "[tenants] data dir removal failed")
  }
  return doc
}

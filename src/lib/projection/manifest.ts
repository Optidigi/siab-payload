import { promises as fs } from "node:fs"
import path from "node:path"
import { writeAtomic } from "@/lib/atomicWrite"

type Entry = { type: "page" | "media" | "settings"; key: string; updatedAt: string }
export type Manifest = { tenantId: string; version: number; updatedAt: string; entries: Entry[] }

const manifestPath = (dataDir: string, tenantId: string) =>
  path.join(dataDir, "tenants", tenantId, "manifest.json")

export async function readManifest(dataDir: string, tenantId: string): Promise<Manifest> {
  try {
    const buf = await fs.readFile(manifestPath(dataDir, tenantId), "utf8")
    return JSON.parse(buf)
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return { tenantId, version: 0, updatedAt: new Date(0).toISOString(), entries: [] }
    }
    throw err
  }
}

export async function writeManifest(dataDir: string, m: Manifest): Promise<void> {
  await writeAtomic(manifestPath(dataDir, m.tenantId), JSON.stringify(m, null, 2))
}

export function upsertEntry(m: Manifest, e: Entry): Manifest {
  const filtered = m.entries.filter(x => !(x.type === e.type && x.key === e.key))
  return { ...m, version: m.version + 1, updatedAt: new Date().toISOString(), entries: [...filtered, e] }
}

export function removeEntry(m: Manifest, type: Entry["type"], key: string): Manifest {
  const filtered = m.entries.filter(x => !(x.type === type && x.key === key))
  return { ...m, version: m.version + 1, updatedAt: new Date().toISOString(), entries: filtered }
}

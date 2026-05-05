import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { readManifest, writeManifest, upsertEntry, removeEntry } from "@/lib/projection/manifest"
import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"

let tmp: string
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), "manifest-")) })
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }) })

describe("manifest", () => {
  it("readManifest returns empty when missing", async () => {
    const m = await readManifest(tmp, "t1")
    expect(m.tenantId).toBe("t1")
    expect(m.version).toBe(0)
    expect(m.entries).toEqual([])
  })

  it("upsertEntry replaces existing", () => {
    let m: any = { tenantId: "t1", version: 0, updatedAt: "x", entries: [{ type: "page", key: "home", updatedAt: "y" }] }
    m = upsertEntry(m, { type: "page", key: "home", updatedAt: "z" })
    expect(m.entries).toEqual([{ type: "page", key: "home", updatedAt: "z" }])
    expect(m.version).toBe(1)
  })

  it("upsertEntry appends new", () => {
    let m: any = { tenantId: "t1", version: 0, updatedAt: "x", entries: [{ type: "page", key: "a", updatedAt: "1" }] }
    m = upsertEntry(m, { type: "page", key: "b", updatedAt: "2" })
    expect(m.entries).toHaveLength(2)
  })

  it("writeManifest then readManifest round-trips", async () => {
    const m = upsertEntry(await readManifest(tmp, "t1"), { type: "page", key: "home", updatedAt: "2026-05-05" })
    await writeManifest(tmp, m)
    const m2 = await readManifest(tmp, "t1")
    expect(m2.entries[0]).toEqual({ type: "page", key: "home", updatedAt: "2026-05-05" })
  })

  it("removeEntry drops matching entries", () => {
    let m: any = { tenantId: "t1", version: 1, updatedAt: "x", entries: [{ type: "page", key: "a", updatedAt: "1" }, { type: "page", key: "b", updatedAt: "1" }] }
    m = removeEntry(m, "page", "a")
    expect(m.entries).toEqual([{ type: "page", key: "b", updatedAt: "1" }])
  })
})

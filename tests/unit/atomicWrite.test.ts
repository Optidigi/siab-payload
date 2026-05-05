import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { writeAtomic } from "@/lib/atomicWrite"
import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"

let tmpdir: string
beforeEach(async () => { tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), "siab-")) })
afterEach(async () => { await fs.rm(tmpdir, { recursive: true, force: true }) })

describe("writeAtomic", () => {
  it("writes content to the target path", async () => {
    const target = path.join(tmpdir, "a", "b", "c.json")
    await writeAtomic(target, '{"x":1}')
    expect(await fs.readFile(target, "utf8")).toBe('{"x":1}')
  })

  it("creates parent directories", async () => {
    const target = path.join(tmpdir, "deep/very/deep/file.txt")
    await writeAtomic(target, "ok")
    expect(await fs.readFile(target, "utf8")).toBe("ok")
  })

  it("does not leave .tmp behind on success", async () => {
    const target = path.join(tmpdir, "x.json")
    await writeAtomic(target, "{}")
    const dir = await fs.readdir(tmpdir)
    expect(dir).toEqual(["x.json"])
  })
})

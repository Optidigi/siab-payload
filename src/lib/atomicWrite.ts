import { promises as fs } from "node:fs"
import path from "node:path"

export async function writeAtomic(target: string, content: string): Promise<void> {
  const dir = path.dirname(target)
  await fs.mkdir(dir, { recursive: true })

  const tmp = `${target}.tmp.${process.pid}.${Date.now()}`
  const fh = await fs.open(tmp, "w")
  try {
    await fh.writeFile(content)
    await fh.sync()
  } finally {
    await fh.close()
  }
  await fs.rename(tmp, target)
}

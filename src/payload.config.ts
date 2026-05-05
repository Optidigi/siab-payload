import { postgresAdapter } from "@payloadcms/db-postgres"
import { lexicalEditor } from "@payloadcms/richtext-lexical"
import path from "path"
import { buildConfig } from "payload"
import { fileURLToPath } from "url"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "",
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI || "" }
  }),
  editor: lexicalEditor(),
  collections: [],
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts")
  },
  admin: {
    user: undefined
    // Will be set to disable: true in Phase 5. Kept enabled for Phase 0–4 verification.
  }
})

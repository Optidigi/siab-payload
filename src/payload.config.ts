import { postgresAdapter } from "@payloadcms/db-postgres"
import { resendAdapter } from "@payloadcms/email-resend"
import { multiTenantPlugin } from "@payloadcms/plugin-multi-tenant"
import { lexicalEditor } from "@payloadcms/richtext-lexical"
import path from "path"
import { buildConfig } from "payload"
import { fileURLToPath } from "url"

import { Forms } from "@/collections/Forms"
import { Media } from "@/collections/Media"
import { Pages } from "@/collections/Pages"
import { SiteSettings } from "@/collections/SiteSettings"
import { Tenants } from "@/collections/Tenants"
import { Users } from "@/collections/Users"
import type { Config } from "@/payload-types"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Fail fast on missing required env. An empty PAYLOAD_SECRET produces forgeable
// JWTs/cookies; an empty DATABASE_URI surfaces later as an opaque pg error.
const PAYLOAD_SECRET = process.env.PAYLOAD_SECRET
if (!PAYLOAD_SECRET) {
  throw new Error("PAYLOAD_SECRET is required (set in .env or environment)")
}
const DATABASE_URI = process.env.DATABASE_URI
if (!DATABASE_URI) {
  throw new Error("DATABASE_URI is required (set in .env or environment)")
}

// TODO(phase-1.3): add `cors` + `csrf` allowlists when the orchestrator API
// becomes a non-same-origin caller, or confirm same-origin and document.

export default buildConfig({
  secret: PAYLOAD_SECRET,
  db: postgresAdapter({
    pool: { connectionString: DATABASE_URI },
    // Auto-push schema changes (matches dev behavior, but explicit so it
    // also runs in NODE_ENV=production). We rebuild from source on every
    // schema-affecting code change, so the push is always intentional and
    // bounded; no live ad-hoc DDL. Drizzle warns destructive changes.
    push: true
  }),
  editor: lexicalEditor(),
  email: resendAdapter({
    defaultFromAddress: process.env.EMAIL_FROM || "noreply@siteinabox.nl",
    defaultFromName: "SiteInABox",
    apiKey: process.env.RESEND_API_KEY || ""
  }),
  collections: [Tenants, Users, Media, Pages, SiteSettings, Forms],
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts")
  },
  admin: {
    user: "users",
    disable: true
  },
  plugins: [
    multiTenantPlugin<Config>({
      collections: {
        pages: {},
        media: {},
        "site-settings": { isGlobal: false },
        forms: {}
      },
      tenantField: { name: "tenant" },
      tenantsArrayField: { includeDefaultField: false },
      userHasAccessToAllTenants: (user) => user?.role === "super-admin"
    })
  ]
})

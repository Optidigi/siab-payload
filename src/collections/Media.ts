import type { CollectionConfig } from "payload"
import path from "path"
import { canRead, canWrite } from "@/access/roleHelpers"
import { projectMediaToDisk } from "@/hooks/projectToDisk"

export const Media: CollectionConfig = {
  slug: "media",
  access: { read: canRead, create: canWrite, update: canWrite, delete: canWrite },
  upload: {
    // Files written under DATA_DIR/_uploads-tmp/ during create/update; the
    // projectMediaToDisk hook (Phase 4) moves each file into the per-tenant
    // dir at DATA_DIR/tenants/<tenantId>/media/.
    staticDir: path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out", "_uploads-tmp"),
    mimeTypes: ["image/*", "video/mp4", "application/pdf"]
  },
  admin: { useAsTitle: "filename", defaultColumns: ["filename", "alt", "mimeType", "filesize"] },
  fields: [
    { name: "alt", type: "text" },
    { name: "caption", type: "text" }
  ],
  hooks: {
    afterChange: [projectMediaToDisk]
  }
}

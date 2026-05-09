import type { CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import {
  archiveTenantDir,
  clearTenantCookieIfStale,
  createTenantDir,
  removeTenantDir,
  restoreTenantDir
} from "@/hooks/tenantLifecycle"

// FN-2026-0004 — server-side slug format guard. The /sites/new + /edit
// forms enforce this regex client-side via zod, but a direct PATCH (browser
// console, scripted client, future mobile app) bypassed the rule and
// persisted invalid URL slugs. Mirrors `src/components/forms/TenantForm.tsx`
// + `TenantEditForm.tsx` so the message is consistent everywhere the user
// might see it.
const SLUG_REGEX = /^[a-z0-9-]+$/
const validateSlug = (val: unknown) => {
  if (val == null || val === "") return "Slug is required"
  if (typeof val !== "string" || !SLUG_REGEX.test(val)) {
    return "Lowercase, digits, hyphens only"
  }
  return true
}

export const Tenants: CollectionConfig = {
  slug: "tenants",
  access: {
    create: isSuperAdmin,
    read: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin
  },
  admin: { useAsTitle: "name", defaultColumns: ["name", "domain", "status"] },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true, validate: validateSlug,
      admin: { description: "URL-safe id used in super-admin URLs (/sites/<slug>)" } },
    { name: "domain", type: "text", required: true, unique: true,
      admin: { description: "Production domain, e.g. clientasite.nl. Looked up from Host header." } },
    { name: "status", type: "select", required: true, defaultValue: "provisioning",
      options: [
        { label: "Provisioning", value: "provisioning" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Archived", value: "archived" }
      ] },
    { name: "siteRepo", type: "text", admin: { description: "GitHub repo, e.g. optidigi/site-clientasite" } },
    { name: "notes", type: "textarea" }
  ],
  hooks: {
    afterChange: [createTenantDir, archiveTenantDir, restoreTenantDir],
    afterDelete: [removeTenantDir, clearTenantCookieIfStale]
  }
}

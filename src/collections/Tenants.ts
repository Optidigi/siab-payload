import type { CollectionConfig } from "payload"

export const Tenants: CollectionConfig = {
  slug: "tenants",
  admin: { useAsTitle: "name", defaultColumns: ["name", "domain", "status"] },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true,
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
  ]
}

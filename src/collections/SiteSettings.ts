import type { CollectionConfig } from "payload"
import { canRead, canUpdateSettings } from "@/access/roleHelpers"
import { projectSettingsToDisk } from "@/hooks/projectToDisk"

export const SiteSettings: CollectionConfig = {
  slug: "site-settings",
  access: {
    read: canRead,
    create: canUpdateSettings,
    update: canUpdateSettings,
    delete: ({ req }) => req.user?.role === "super-admin"
  },
  admin: { useAsTitle: "siteName", description: "One record per tenant." },
  fields: [
    { name: "siteName", type: "text", required: true },
    { name: "siteUrl", type: "text", required: true,
      admin: { description: "Public URL of the SSR site (e.g. https://clientasite.nl)" } },
    { name: "contactEmail", type: "email" },
    { name: "branding", type: "group", fields: [
      { name: "logo", type: "upload", relationTo: "media" },
      { name: "primaryColor", type: "text", admin: { description: "Hex (e.g. #2563eb)" } }
    ]},
    { name: "contact", type: "group", fields: [
      { name: "phone", type: "text" },
      { name: "address", type: "textarea" },
      { name: "social", type: "array", fields: [
        { name: "platform", type: "text", required: true },
        { name: "url", type: "text", required: true }
      ]}
    ]},
    { name: "navigation", type: "array", fields: [
      { name: "label", type: "text", required: true },
      { name: "href", type: "text", required: true },
      { name: "external", type: "checkbox", defaultValue: false }
    ]}
  ],
  hooks: {
    afterChange: [projectSettingsToDisk]
  }
}

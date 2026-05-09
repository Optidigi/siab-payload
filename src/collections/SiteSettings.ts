import type { CollectionConfig } from "payload"
import { canRead, canUpdateSettings } from "@/access/roleHelpers"
import { projectSettingsToDisk } from "@/hooks/projectToDisk"

// HH:MM 24h matcher. Accepts 00:00–23:59.
const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const validateHHMM = (val: unknown, { siblingData }: any) => {
  // If the row is marked closed, open/close are ignored — empty is fine.
  if (siblingData?.closed) return true
  if (val == null || val === "") return "Required when the day is not closed"
  if (typeof val !== "string" || !TIME_HHMM.test(val)) return "Use HH:MM 24h format (e.g. 09:00)"
  return true
}

// FN-2026-0004 — primaryColor accepted any free-text string. Validate as a
// 3- or 6-digit hex color (with leading '#'). Empty is allowed (field is
// optional — the renderer falls back to a default when unset).
const HEX_COLOR_REGEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const validatePrimaryColor = (val: unknown) => {
  if (val == null || val === "") return true
  if (typeof val !== "string" || !HEX_COLOR_REGEX.test(val)) {
    return "Hex color (e.g. #2563eb or #25b)"
  }
  return true
}

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
    { name: "description", type: "textarea",
      admin: { description: "One-paragraph site description (used in <meta name=\"description\"> and footers)." } },
    { name: "language", type: "text", defaultValue: "en",
      admin: { description: "ISO 639-1 lang code, used in <html lang>. Default 'en'." } },
    { name: "aliases", type: "array",
      admin: { description: "Alternative domains that should serve the same site (e.g. www.foo.com aliased to foo.com)." },
      fields: [
        { name: "host", type: "text", required: true }
      ]},
    { name: "contactEmail", type: "email" },
    { name: "branding", type: "group", fields: [
      { name: "logo", type: "upload", relationTo: "media" },
      { name: "primaryColor", type: "text", validate: validatePrimaryColor,
        admin: { description: "Hex (e.g. #2563eb)" } }
    ]},
    { name: "contact", type: "group", fields: [
      { name: "phone", type: "text" },
      { name: "address", type: "textarea" },
      { name: "social", type: "array", fields: [
        { name: "platform", type: "text", required: true },
        { name: "url", type: "text", required: true }
      ]}
    ]},
    { name: "nap", type: "group",
      admin: { description: "Name / Address / Phone — canonical legal-entity contact info used for SEO and footer." },
      fields: [
        { name: "legalName", type: "text",
          admin: { description: "Legal entity name (may differ from siteName/brand)." } },
        { name: "streetAddress", type: "text" },
        { name: "city", type: "text" },
        { name: "region", type: "text", admin: { description: "Province / state." } },
        { name: "postalCode", type: "text" },
        { name: "country", type: "text", defaultValue: "NL",
          admin: { description: "ISO 3166-1 alpha-2 (default 'NL')." } }
      ]},
    { name: "hours", type: "array",
      admin: { description: "Opening hours per weekday. Use 'closed' for days the business is closed." },
      fields: [
        { name: "day", type: "select", required: true, options: [
          { label: "Monday", value: "monday" },
          { label: "Tuesday", value: "tuesday" },
          { label: "Wednesday", value: "wednesday" },
          { label: "Thursday", value: "thursday" },
          { label: "Friday", value: "friday" },
          { label: "Saturday", value: "saturday" },
          { label: "Sunday", value: "sunday" }
        ]},
        { name: "open", type: "text", validate: validateHHMM,
          admin: { description: "HH:MM 24h. Required unless the day is closed." } },
        { name: "close", type: "text", validate: validateHHMM,
          admin: { description: "HH:MM 24h. Required unless the day is closed." } },
        { name: "closed", type: "checkbox", defaultValue: false,
          admin: { description: "When checked, open/close are ignored." } }
      ]},
    { name: "serviceArea", type: "array",
      admin: { description: "Geographic regions (cities, postcodes, etc.) the business serves." },
      fields: [
        { name: "name", type: "text", required: true }
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

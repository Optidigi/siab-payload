import type { CollectionConfig } from "payload"

export const Forms: CollectionConfig = {
  slug: "forms",
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "formName", "status", "createdAt"],
    description: "Submissions inbox. Created by public form posts; managed by tenant editors."
  },
  fields: [
    { name: "formName", type: "text", required: true },
    { name: "pageUrl", type: "text" },
    { name: "data", type: "json", required: true,
      admin: { description: "Full submission payload as posted" } },
    { name: "email", type: "text" },
    { name: "name", type: "text" },
    { name: "message", type: "textarea" },
    { name: "status", type: "select", required: true, defaultValue: "new",
      options: [
        { label: "New", value: "new" },
        { label: "Read", value: "read" },
        { label: "Contacted", value: "contacted" },
        { label: "Spam", value: "spam" }
      ]},
    { name: "ipAddress", type: "text",
      access: { read: ({ req }) => req.user?.role === "super-admin" || req.user?.role === "owner" } }
  ]
}

import type { CollectionConfig, JSONFieldValidation } from "payload"
import { canRead, canWrite } from "@/access/roleHelpers"

// Audit-p1 #5 sub-fix 2 (T4) — payload-size DoS cap on the public-create
// surface. The audit's suggested cap is ~32 KB, sized for typical contact-
// form payloads (name + email + message + a few hidden fields) with
// comfortable headroom. Enforced as a field-level `validate` on `data` so
// the rejection happens before any DB write and surfaces a 400 with a
// readable error rather than a Postgres column-size or oom error later.
//
// Boundary is INCLUSIVE — exactly 32_768 bytes is permitted; over is
// rejected. Documented in the test (Case 11) and the batch report.
//
// `value == null` is normalised to `{}` before measurement so partial
// updates that don't touch `data` (e.g. an admin marking a submission as
// "read") don't trip the cap.
const MAX_FORM_DATA_BYTES = 32_768

const validateFormData: JSONFieldValidation = (value) => {
  const serialised = JSON.stringify(value ?? {})
  if (serialised.length > MAX_FORM_DATA_BYTES) {
    return `data exceeds ${MAX_FORM_DATA_BYTES}-byte cap (got ${serialised.length} bytes)`
  }
  return true
}

export const Forms: CollectionConfig = {
  slug: "forms",
  access: {
    read: canRead,
    // Public form posts: any unauthenticated visitor can submit. Anonymous
    // flood is mitigated upstream by middleware rate-limit at /api/forms
    // (audit-p1 #5 sub-fix 1, src/middleware.ts) — 10 POSTs / 60s / IP.
    // Per-record payload size is capped here in `data`'s validate.
    create: () => true,
    update: canWrite,
    delete: ({ req }) => req.user?.role === "super-admin" || req.user?.role === "owner"
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "formName", "status", "createdAt"],
    description: "Submissions inbox. Created by public form posts; managed by tenant editors."
  },
  fields: [
    { name: "formName", type: "text", required: true },
    { name: "pageUrl", type: "text" },
    { name: "data", type: "json", required: true, validate: validateFormData,
      admin: { description: "Full submission payload as posted (max 32 KB)" } },
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

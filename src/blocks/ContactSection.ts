import type { Block } from "payload"

export const ContactSection: Block = {
  slug: "contactSection",
  interfaceName: "ContactSectionBlock",
  fields: [
    { name: "title", type: "text" },
    { name: "description", type: "textarea" },
    { name: "formName", type: "text", required: true, defaultValue: "Contact form",
      admin: { description: "Used as Forms.formName when storing submissions" } },
    { name: "fields", type: "array", required: true, fields: [
      { name: "name", type: "text", required: true },
      { name: "label", type: "text", required: true },
      { name: "type", type: "select", required: true, defaultValue: "text",
        options: [
          { label: "Text", value: "text" },
          { label: "Email", value: "email" },
          { label: "Tel", value: "tel" },
          { label: "Textarea", value: "textarea" }
        ]},
      { name: "required", type: "checkbox", defaultValue: false }
    ]}
  ]
}

import type { Block } from "payload"

export const Testimonials: Block = {
  slug: "testimonials",
  interfaceName: "TestimonialsBlock",
  fields: [
    { name: "title", type: "text" },
    { name: "items", type: "array", required: true, fields: [
      { name: "quote", type: "textarea", required: true },
      { name: "author", type: "text", required: true },
      { name: "role", type: "text" },
      { name: "avatar", type: "upload", relationTo: "media" }
    ]}
  ]
}

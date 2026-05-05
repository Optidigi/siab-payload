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
      // @ts-expect-error -- "media" CollectionSlug registered in Task 2.6
      { name: "avatar", type: "upload", relationTo: "media" }
    ]}
  ]
}

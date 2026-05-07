import type { Block } from "payload"
import { truncate } from "./_summary"

export const Testimonials: Block & { summary?: (v: Record<string, unknown>) => string | undefined } = {
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
  ],
  summary: (v) => {
    const title = typeof v.title === "string" ? v.title.trim() : ""
    return title ? truncate(title, 40) : undefined
  },
}

import type { Block } from "payload"

export const Hero: Block = {
  slug: "hero",
  interfaceName: "HeroBlock",
  fields: [
    { name: "eyebrow", type: "text" },
    { name: "headline", type: "text", required: true },
    { name: "subheadline", type: "textarea" },
    { name: "cta", type: "group", fields: [
      { name: "label", type: "text" },
      { name: "href", type: "text" }
    ]},
    // @ts-expect-error -- "media" CollectionSlug registered in Task 2.6
    { name: "image", type: "upload", relationTo: "media" }
  ]
}

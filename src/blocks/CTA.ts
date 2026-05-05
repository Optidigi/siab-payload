import type { Block } from "payload"

export const CTA: Block = {
  slug: "cta",
  interfaceName: "CTABlock",
  fields: [
    { name: "headline", type: "text", required: true },
    { name: "description", type: "textarea" },
    { name: "primary", type: "group", fields: [
      { name: "label", type: "text", required: true },
      { name: "href", type: "text", required: true }
    ]},
    { name: "secondary", type: "group", fields: [
      { name: "label", type: "text" },
      { name: "href", type: "text" }
    ]}
  ]
}

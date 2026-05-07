import type { Block } from "payload"
import { truncate } from "./_summary"

export const CTA: Block & { summary?: (v: Record<string, unknown>) => string | undefined } = {
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
  ],
  summary: (v) => {
    const headline = typeof v.headline === "string" ? v.headline.trim() : ""
    return headline ? truncate(headline, 40) : undefined
  },
}

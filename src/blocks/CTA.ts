import { MousePointerClick } from "lucide-react"
import { truncate, type BlockWithMeta } from "./_summary"

export const CTA: BlockWithMeta = {
  slug: "cta",
  icon: MousePointerClick,
  description: "Call-to-action with button",
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

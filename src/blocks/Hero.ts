import { Sparkles } from "lucide-react"
import { truncate, type BlockWithMeta } from "./_summary"

export const Hero: BlockWithMeta = {
  slug: "hero",
  icon: Sparkles,
  description: "Large headline section with optional image",
  interfaceName: "HeroBlock",
  fields: [
    { name: "eyebrow", type: "text" },
    { name: "headline", type: "text", required: true },
    { name: "subheadline", type: "textarea" },
    { name: "cta", type: "group", fields: [
      { name: "label", type: "text" },
      { name: "href", type: "text" }
    ]},
    { name: "image", type: "upload", relationTo: "media" }
  ],
  summary: (v) => {
    const headline = typeof v.headline === "string" ? v.headline.trim() : ""
    return headline ? truncate(headline, 40) : undefined
  },
}

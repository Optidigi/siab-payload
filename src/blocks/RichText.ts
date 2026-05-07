import { Type } from "lucide-react"
import { truncate, type BlockWithMeta } from "./_summary"

export const RichText: BlockWithMeta = {
  slug: "richText",
  icon: Type,
  description: "Long-form text content",
  interfaceName: "RichTextBlock",
  fields: [
    { name: "body", type: "textarea", required: true,
      admin: { description: "v1: textarea. Tiptap-backed editor in v2 swaps the renderer only." } }
  ],
  summary: (v) => {
    // body is a plain textarea string in v1
    if (typeof v.body === "string" && v.body.trim()) {
      return truncate(v.body.trim(), 40)
    }
    return undefined
  },
}

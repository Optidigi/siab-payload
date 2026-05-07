import type { Block } from "payload"
import { truncate } from "./_summary"

export const RichText: Block & { summary?: (v: Record<string, unknown>) => string | undefined } = {
  slug: "richText",
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

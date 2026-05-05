import type { Block } from "payload"

export const RichText: Block = {
  slug: "richText",
  interfaceName: "RichTextBlock",
  fields: [
    { name: "body", type: "textarea", required: true,
      admin: { description: "v1: textarea. Tiptap-backed editor in v2 swaps the renderer only." } }
  ]
}

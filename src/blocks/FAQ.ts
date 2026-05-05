import type { Block } from "payload"

export const FAQ: Block = {
  slug: "faq",
  interfaceName: "FAQBlock",
  fields: [
    { name: "title", type: "text" },
    { name: "items", type: "array", required: true, fields: [
      { name: "question", type: "text", required: true },
      { name: "answer", type: "textarea", required: true }
    ]}
  ]
}

import type { Block } from "payload"
import { truncate } from "./_summary"

export const FAQ: Block & { summary?: (v: Record<string, unknown>) => string | undefined } = {
  slug: "faq",
  interfaceName: "FAQBlock",
  fields: [
    { name: "title", type: "text" },
    { name: "items", type: "array", required: true, fields: [
      { name: "question", type: "text", required: true },
      { name: "answer", type: "textarea", required: true }
    ]}
  ],
  summary: (v) => {
    if (typeof v.title === "string" && v.title.trim()) {
      return truncate(v.title.trim(), 40)
    }
    const items = Array.isArray(v.items) ? v.items : []
    const firstQ = items[0] && typeof (items[0] as Record<string, unknown>).question === "string"
      ? ((items[0] as Record<string, unknown>).question as string).trim()
      : ""
    return firstQ ? truncate(firstQ, 40) : undefined
  },
}

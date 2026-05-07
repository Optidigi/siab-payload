import type { Block } from "payload"
import { truncate } from "./_summary"

export const FeatureList: Block & { summary?: (v: Record<string, unknown>) => string | undefined } = {
  slug: "featureList",
  interfaceName: "FeatureListBlock",
  fields: [
    { name: "title", type: "text" },
    { name: "intro", type: "textarea" },
    { name: "features", type: "array", required: true, fields: [
      { name: "title", type: "text", required: true },
      { name: "description", type: "textarea" },
      { name: "icon", type: "text", admin: { description: "kebab-case lucide-preact icon name (e.g. \"map-pin\", \"check-circle\"). See the allowlist in the deployed Astro template's src/components/cms/icons.ts for what's available." } }
    ]}
  ],
  summary: (v) => {
    const title = typeof v.title === "string" ? v.title.trim() : ""
    return title ? truncate(title, 40) : undefined
  },
}

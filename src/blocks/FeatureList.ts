import type { Block } from "payload"

export const FeatureList: Block = {
  slug: "featureList",
  interfaceName: "FeatureListBlock",
  fields: [
    { name: "title", type: "text" },
    { name: "intro", type: "textarea" },
    { name: "features", type: "array", required: true, fields: [
      { name: "title", type: "text", required: true },
      { name: "description", type: "textarea" },
      { name: "icon", type: "text", admin: { description: "lucide-react icon name" } }
    ]}
  ]
}

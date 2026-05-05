import type { CollectionConfig } from "payload"
import { Hero } from "@/blocks/Hero"
import { FeatureList } from "@/blocks/FeatureList"
import { Testimonials } from "@/blocks/Testimonials"
import { FAQ } from "@/blocks/FAQ"
import { CTA } from "@/blocks/CTA"
import { RichText } from "@/blocks/RichText"
import { ContactSection } from "@/blocks/ContactSection"

export const Pages: CollectionConfig = {
  slug: "pages",
  admin: { useAsTitle: "title", defaultColumns: ["title", "slug", "status", "updatedAt"] },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true,
      admin: { description: "URL slug. Unique per tenant. 'home' for the root page." } },
    { name: "status", type: "select", required: true, defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" }
      ]},
    { name: "blocks", type: "blocks",
      blocks: [Hero, FeatureList, Testimonials, FAQ, CTA, RichText, ContactSection] },
    { name: "seo", type: "group", fields: [
      { name: "title", type: "text" },
      { name: "description", type: "textarea" },
      { name: "ogImage", type: "upload", relationTo: "media" }
    ]},
    { name: "updatedBy", type: "relationship", relationTo: "users",
      admin: { readOnly: true, hidden: false } }
  ],
  hooks: {
    beforeChange: [({ data, req }) => {
      if (req.user) data.updatedBy = req.user.id
      return data
    }]
  }
}

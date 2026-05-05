import { describe, it, expect } from "vitest"
import { pageToJson } from "@/lib/projection/pageToJson"

describe("pageToJson — all block types", () => {
  it("Hero block round-trips", () => {
    const json = pageToJson({
      tenant: "t", title: "T", slug: "t", status: "published",
      updatedAt: "2026-05-05T00:00:00.000Z",
      blocks: [{
        id: "1", blockType: "hero",
        eyebrow: "Eyebrow", headline: "H", subheadline: "S",
        cta: { label: "Go", href: "/go" },
        image: { url: "/u/h.png", filename: "h.png" }
      }]
    })
    expect(json.blocks[0]).toMatchObject({
      blockType: "hero",
      eyebrow: "Eyebrow",
      headline: "H",
      subheadline: "S",
      cta: { label: "Go", href: "/go" },
      image: { url: "/u/h.png", filename: "h.png" }
    })
  })

  it("FeatureList block round-trips", () => {
    const json = pageToJson({
      tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x",
      blocks: [{
        id: "1", blockType: "featureList", title: "Why us", intro: "Because",
        features: [
          { id: "f1", title: "Fast", description: "Very", icon: "zap" },
          { id: "f2", title: "Safe", description: "Yes", icon: "shield" }
        ]
      }]
    })
    expect(json.blocks[0]).toMatchObject({
      blockType: "featureList", title: "Why us", intro: "Because",
      features: [
        { title: "Fast", description: "Very", icon: "zap" },
        { title: "Safe", description: "Yes", icon: "shield" }
      ]
    })
  })

  it("Testimonials, FAQ, CTA, RichText, ContactSection round-trip", () => {
    const blocks = [
      { blockType: "testimonials", title: "Love", items: [{ quote: "wow", author: "Jane", role: "CEO" }] },
      { blockType: "faq", title: "Help", items: [{ question: "Q?", answer: "A." }] },
      { blockType: "cta", headline: "Buy", primary: { label: "Buy", href: "/b" } },
      { blockType: "richText", body: "hello" },
      { blockType: "contactSection", title: "Hi", formName: "Contact", fields: [
        { name: "email", label: "Email", type: "email", required: true }
      ]}
    ]
    const json = pageToJson({ tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x", blocks })
    expect(json.blocks).toHaveLength(5)
    expect(json.blocks.every((b: any) => b.blockType)).toBe(true)
    expect(json.blocks.every((b: any) => !("id" in b))).toBe(true)
  })
})

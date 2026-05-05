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

  it("strips nested array-row ids (FAQ items, FeatureList features, ContactSection fields, Testimonials items)", () => {
    const json = pageToJson({
      tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x",
      blocks: [
        { id: "b1", blockType: "faq", title: "Help", items: [
          { id: "row-1", question: "Q1", answer: "A1" },
          { id: "row-2", question: "Q2", answer: "A2" }
        ]},
        { id: "b2", blockType: "featureList", title: "Why", features: [
          { id: "row-3", title: "Fast", description: "v" }
        ]},
        { id: "b3", blockType: "testimonials", title: "L", items: [
          { id: "row-4", quote: "wow", author: "Jane" }
        ]},
        { id: "b4", blockType: "contactSection", title: "Hi", formName: "F", fields: [
          { id: "row-5", name: "email", label: "Email", type: "email", required: true }
        ]}
      ]
    })
    // Top-level block ids stripped (existing behaviour).
    expect(json.blocks.every((b: any) => !("id" in b))).toBe(true)
    // Nested row ids stripped (new behaviour).
    expect((json.blocks[0] as any).items.every((i: any) => !("id" in i))).toBe(true)
    expect((json.blocks[1] as any).features.every((f: any) => !("id" in f))).toBe(true)
    expect((json.blocks[2] as any).items.every((i: any) => !("id" in i))).toBe(true)
    expect((json.blocks[3] as any).fields.every((f: any) => !("id" in f))).toBe(true)
    // Sanity: actual content still present.
    expect((json.blocks[0] as any).items[0].question).toBe("Q1")
    expect((json.blocks[3] as any).fields[0].required).toBe(true)
  })

  it("drops blockName when null/undefined, keeps when string", () => {
    const json = pageToJson({
      tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x",
      blocks: [
        { id: "b1", blockType: "richText", body: "x", blockName: null },
        { id: "b2", blockType: "richText", body: "y", blockName: undefined },
        { id: "b3", blockType: "richText", body: "z", blockName: "Intro" },
        { id: "b4", blockType: "richText", body: "w" }
      ]
    })
    expect(json.blocks[0]).not.toHaveProperty("blockName")
    expect(json.blocks[1]).not.toHaveProperty("blockName")
    expect((json.blocks[2] as any).blockName).toBe("Intro")
    expect(json.blocks[3]).not.toHaveProperty("blockName")
  })

  it("flattens populated Media relationships (drops id, keeps url/filename/alt/w/h)", () => {
    const json = pageToJson({
      tenant: "t", title: "T", slug: "t", status: "published", updatedAt: "x",
      blocks: [
        { id: "b1", blockType: "hero", headline: "H",
          image: { id: 99, url: "/u/h.png", filename: "h.png", alt: "x", width: 10, height: 20 } }
      ]
    })
    // flattenMedia is the existing behaviour: collapses to a deterministic
    // shape and drops the DB id (route resolver re-derives on demand).
    expect((json.blocks[0] as any).image).toEqual({
      url: "/u/h.png", filename: "h.png", alt: "x", width: 10, height: 20
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

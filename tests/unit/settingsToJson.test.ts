import { describe, it, expect } from "vitest"
import { settingsToJson } from "@/lib/projection/settingsToJson"

describe("settingsToJson", () => {
  it("flattens settings with branding/contact/navigation", () => {
    const doc: any = {
      id: "s1", tenant: "t1", siteName: "Client A", siteUrl: "https://clienta.nl",
      contactEmail: "hi@clienta.nl",
      branding: { logo: { url: "/uploads/logo.png", filename: "logo.png" }, primaryColor: "#2563eb" },
      contact: { phone: "+31 20 555 1234", address: "Street 1", social: [{ platform: "instagram", url: "https://ig" }] },
      navigation: [{ label: "Home", href: "/", external: false }]
    }
    const json = settingsToJson(doc)
    expect(json).toMatchObject({
      siteName: "Client A",
      siteUrl: "https://clienta.nl",
      contactEmail: "hi@clienta.nl",
      branding: { primaryColor: "#2563eb" },
      contact: { phone: "+31 20 555 1234", address: "Street 1" },
      navigation: [{ label: "Home", href: "/", external: false }]
    })
    expect(json.branding!.logo).toMatchObject({ url: "/uploads/logo.png", filename: "logo.png" })
    expect(json.contact!.social).toEqual([{ platform: "instagram", url: "https://ig" }])
  })

  it("handles missing optional groups", () => {
    const doc: any = { id: "x", tenant: "t", siteName: "Bare", siteUrl: "https://x" }
    const json = settingsToJson(doc)
    expect(json.siteName).toBe("Bare")
    expect(json.navigation).toEqual([])
    // New optional Wave 5 fields default to empty arrays / undefined groups, not crashes.
    expect(json.aliases).toEqual([])
    expect(json.hours).toEqual([])
    expect(json.serviceArea).toEqual([])
    expect(json.nap).toBeUndefined()
    expect(json.description).toBeUndefined()
    expect(json.language).toBeUndefined()
  })

  it("projects Wave 5 fields (description, language, aliases, nap, hours, serviceArea)", () => {
    const doc: any = {
      id: "s2", tenant: "t1",
      siteName: "Client B", siteUrl: "https://clientb.nl",
      description: "A pleasant little business in Utrecht.",
      language: "nl",
      aliases: [
        // Payload arrays carry an `id` per row; the projector must NOT leak it.
        { id: "row-1", host: "www.clientb.nl" },
        { id: "row-2", host: "clientb.com" }
      ],
      nap: {
        legalName: "Client B B.V.",
        streetAddress: "Hoofdstraat 12",
        city: "Utrecht",
        region: "Utrecht",
        postalCode: "3511 AA",
        country: "NL"
      },
      hours: [
        { id: "h-1", day: "monday", open: "09:00", close: "17:00", closed: false },
        { id: "h-2", day: "saturday", open: null, close: null, closed: true }
      ],
      serviceArea: [
        { id: "sa-1", name: "Utrecht" },
        { id: "sa-2", name: "Amersfoort" }
      ]
    }
    const json = settingsToJson(doc)
    expect(json.description).toBe("A pleasant little business in Utrecht.")
    expect(json.language).toBe("nl")
    expect(json.aliases).toEqual([
      { host: "www.clientb.nl" },
      { host: "clientb.com" }
    ])
    expect(json.nap).toEqual({
      legalName: "Client B B.V.",
      streetAddress: "Hoofdstraat 12",
      city: "Utrecht",
      region: "Utrecht",
      postalCode: "3511 AA",
      country: "NL"
    })
    expect(json.hours).toEqual([
      { day: "monday", open: "09:00", close: "17:00", closed: false },
      { day: "saturday", open: null, close: null, closed: true }
    ])
    expect(json.serviceArea).toEqual([
      { name: "Utrecht" },
      { name: "Amersfoort" }
    ])
    // Sanity: no leaked Payload-internal ids on any array row.
    for (const row of json.aliases) expect(row).not.toHaveProperty("id")
    for (const row of json.hours) expect(row).not.toHaveProperty("id")
    for (const row of json.serviceArea) expect(row).not.toHaveProperty("id")
  })
})

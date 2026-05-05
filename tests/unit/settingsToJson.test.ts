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
  })
})

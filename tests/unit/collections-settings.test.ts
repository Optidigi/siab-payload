import { describe, it, expect } from "vitest"
import { SiteSettings } from "@/collections/SiteSettings"

const findField = (name: string): any => SiteSettings.fields.find((f: any) => f.name === name)

describe("SiteSettings collection config", () => {
  it("uses 'site-settings' slug", () => {
    expect(SiteSettings.slug).toBe("site-settings")
  })

  it("keeps original siteName / siteUrl required text fields", () => {
    expect(findField("siteName")).toMatchObject({ type: "text", required: true })
    expect(findField("siteUrl")).toMatchObject({ type: "text", required: true })
  })

  it("adds a textarea description field (optional)", () => {
    const f = findField("description")
    expect(f).toBeDefined()
    expect(f.type).toBe("textarea")
    expect(f.required).not.toBe(true)
  })

  it("adds language text with default 'en'", () => {
    const f = findField("language")
    expect(f).toBeDefined()
    expect(f.type).toBe("text")
    expect(f.defaultValue).toBe("en")
  })

  it("adds aliases array with required host", () => {
    const f = findField("aliases")
    expect(f.type).toBe("array")
    const host = f.fields.find((x: any) => x.name === "host")
    expect(host).toMatchObject({ type: "text", required: true })
  })

  it("adds nap group with the expected sub-fields", () => {
    const f = findField("nap")
    expect(f.type).toBe("group")
    const subNames = f.fields.map((x: any) => x.name).sort()
    expect(subNames).toEqual([
      "city", "country", "legalName", "postalCode", "region", "streetAddress"
    ])
    const country = f.fields.find((x: any) => x.name === "country")
    expect(country.defaultValue).toBe("NL")
  })

  it("adds hours array with day/open/close/closed", () => {
    const f = findField("hours")
    expect(f.type).toBe("array")
    const day = f.fields.find((x: any) => x.name === "day")
    expect(day.type).toBe("select")
    expect(day.required).toBe(true)
    expect(day.options.map((o: any) => o.value)).toEqual([
      "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
    ])
    expect(f.fields.find((x: any) => x.name === "open")?.type).toBe("text")
    expect(f.fields.find((x: any) => x.name === "close")?.type).toBe("text")
    const closed = f.fields.find((x: any) => x.name === "closed")
    expect(closed.type).toBe("checkbox")
    expect(closed.defaultValue).toBe(false)
  })

  it("hours.open/close validate skips when row is closed and rejects bad strings", () => {
    const f = findField("hours")
    const openField = f.fields.find((x: any) => x.name === "open")
    // Closed row: any value (or none) is fine.
    expect(openField.validate(undefined, { siblingData: { closed: true } })).toBe(true)
    // Open row: empty / missing is rejected.
    expect(openField.validate("", { siblingData: { closed: false } })).not.toBe(true)
    expect(openField.validate(undefined, { siblingData: { closed: false } })).not.toBe(true)
    // Open row: malformed strings rejected.
    expect(openField.validate("9:00", { siblingData: { closed: false } })).not.toBe(true)
    expect(openField.validate("24:00", { siblingData: { closed: false } })).not.toBe(true)
    expect(openField.validate("12:60", { siblingData: { closed: false } })).not.toBe(true)
    // Open row: well-formed HH:MM accepted.
    expect(openField.validate("09:00", { siblingData: { closed: false } })).toBe(true)
    expect(openField.validate("23:59", { siblingData: { closed: false } })).toBe(true)
    expect(openField.validate("00:00", { siblingData: { closed: false } })).toBe(true)
  })

  it("adds serviceArea array with required name", () => {
    const f = findField("serviceArea")
    expect(f.type).toBe("array")
    const name = f.fields.find((x: any) => x.name === "name")
    expect(name).toMatchObject({ type: "text", required: true })
  })
})

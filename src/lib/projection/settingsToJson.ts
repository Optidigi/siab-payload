const flattenMedia = (m: any) => {
  if (!m) return null
  if (typeof m === "string" || typeof m === "number") return { id: m }
  return { url: m.url, filename: m.filename, alt: m.alt, width: m.width, height: m.height }
}

export function settingsToJson(doc: any) {
  return {
    siteName: doc.siteName,
    siteUrl: doc.siteUrl,
    description: doc.description,
    language: doc.language,
    aliases: (doc.aliases ?? []).map((a: any) => ({ host: a.host })),
    contactEmail: doc.contactEmail,
    branding: doc.branding ? {
      logo: flattenMedia(doc.branding.logo),
      primaryColor: doc.branding.primaryColor
    } : undefined,
    contact: doc.contact ? {
      phone: doc.contact.phone,
      address: doc.contact.address,
      social: (doc.contact.social ?? []).map((s: any) => ({ platform: s.platform, url: s.url }))
    } : undefined,
    nap: doc.nap ? {
      legalName: doc.nap.legalName,
      streetAddress: doc.nap.streetAddress,
      city: doc.nap.city,
      region: doc.nap.region,
      postalCode: doc.nap.postalCode,
      country: doc.nap.country
    } : undefined,
    hours: (doc.hours ?? []).map((h: any) => ({
      day: h.day,
      open: h.open,
      close: h.close,
      closed: !!h.closed
    })),
    serviceArea: (doc.serviceArea ?? []).map((s: any) => ({ name: s.name })),
    navigation: (doc.navigation ?? []).map((n: any) => ({ label: n.label, href: n.href, external: !!n.external }))
  }
}

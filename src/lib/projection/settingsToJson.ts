const flattenMedia = (m: any) => {
  if (!m) return null
  if (typeof m === "string" || typeof m === "number") return { id: m }
  return { url: m.url, filename: m.filename, alt: m.alt, width: m.width, height: m.height }
}

export function settingsToJson(doc: any) {
  return {
    siteName: doc.siteName,
    siteUrl: doc.siteUrl,
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
    navigation: (doc.navigation ?? []).map((n: any) => ({ label: n.label, href: n.href, external: !!n.external }))
  }
}

import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { TenantEditForm } from "@/components/forms/TenantEditForm"
import { PageHeader } from "@/components/layout/PageHeader"
import { notFound } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"

export default async function EditTenantPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()

  // Pre-fetch counts for the danger-zone preview so the operator sees what
  // a delete will actually wipe before they confirm. Doing this server-side
  // keeps the form prop-driven (no extra fetch on dialog open).
  const payload = await getPayload({ config })
  const filter = { tenant: { equals: tenant.id } } as const
  const [pages, media, forms, siteSettings] = await Promise.all([
    payload.count({ collection: "pages",         where: filter, overrideAccess: true }),
    payload.count({ collection: "media",         where: filter, overrideAccess: true }),
    payload.count({ collection: "forms",         where: filter, overrideAccess: true }),
    payload.count({ collection: "site-settings", where: filter, overrideAccess: true })
  ])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Edit tenant"
        subtitle={`${tenant.name} · ${tenant.domain}`}
        tenant={{ name: tenant.name, slug: tenant.slug }}
      />
      <TenantEditForm
        // Defensive: force a fresh client form mount when slug changes
        // (post-rename navigation). Today the route segment unmounts the
        // form on its own, but if the form ever lifts above the [slug]
        // segment, this guards against stale react-hook-form defaultValues.
        key={tenant.slug}
        tenant={tenant}
        counts={{
          pages: pages.totalDocs,
          media: media.totalDocs,
          forms: forms.totalDocs,
          siteSettings: siteSettings.totalDocs
        }}
      />
    </div>
  )
}

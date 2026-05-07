import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/layout/PageHeader"
import { notFound } from "next/navigation"

export default async function NewPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="New page"
        tenant={{ name: tenant.name, slug: tenant.slug }}
      />
      <PageForm
        tenantId={tenant.id}
        baseHref={`/sites/${slug}/pages`}
        tenantOrigin={`https://${tenant.domain}`}
      />
    </div>
  )
}

import type { Metadata } from "next"
import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { getPageById } from "@/lib/queries/pages"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/layout/PageHeader"
import { notFound } from "next/navigation"

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; id: string }> }
): Promise<Metadata> {
  const { slug, id } = await params
  const [tenant, page] = await Promise.all([getTenantBySlug(slug), getPageById(Number(id)).catch(() => null)])
  if (!tenant || !page) return { title: "Page" }
  return { title: `${page.title} · ${tenant.name}` }
}

export default async function EditPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  await requireRole(["super-admin"])
  const { slug, id } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const page = await getPageById(Number(id))
  const pageTenantId = typeof page.tenant === "object" && page.tenant ? page.tenant.id : page.tenant
  if (!page || pageTenantId !== tenant.id) notFound()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={page.title}
        tenant={{ name: tenant.name, slug: tenant.slug }}
      />
      <PageForm
        initial={page as any}
        tenantId={tenant.id}
        baseHref={`/sites/${slug}/pages`}
        tenantOrigin={`https://${tenant.domain}`}
      />
    </div>
  )
}

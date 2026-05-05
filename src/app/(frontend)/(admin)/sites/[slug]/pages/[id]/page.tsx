import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { getPageById } from "@/lib/queries/pages"
import { PageForm } from "@/components/forms/PageForm"
import { notFound } from "next/navigation"

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
      <h1 className="text-xl font-semibold">{page.title}</h1>
      <PageForm initial={page as any} tenantId={tenant.id} baseHref={`/sites/${slug}/pages`}/>
    </div>
  )
}

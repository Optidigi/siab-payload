import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { PageForm } from "@/components/forms/PageForm"
import { notFound } from "next/navigation"

export default async function NewPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New page · {tenant.name}</h1>
      <PageForm tenantId={tenant.id} baseHref={`/sites/${slug}/pages`}/>
    </div>
  )
}

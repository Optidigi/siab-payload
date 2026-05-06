import { notFound, redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { getPageById } from "@/lib/queries/pages"
import { PageForm } from "@/components/forms/PageForm"

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const { id } = await params
  const page = await getPageById(Number(id))
  const pageTenantId = typeof page.tenant === "object" && page.tenant ? page.tenant.id : page.tenant
  if (!page || pageTenantId !== ctx.tenant.id) notFound()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{page.title}</h1>
      <PageForm
        initial={page as any}
        tenantId={ctx.tenant.id}
        baseHref="/pages"
        tenantOrigin={`https://${ctx.tenant.domain}`}
      />
    </div>
  )
}

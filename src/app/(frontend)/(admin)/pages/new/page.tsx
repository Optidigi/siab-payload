import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"

export default async function NewTenantPage() {
  const { ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="New page" />
      <PageForm
        tenantId={ctx.tenant.id}
        baseHref="/pages"
        tenantOrigin={`https://${ctx.tenant.domain}`}
      />
    </div>
  )
}

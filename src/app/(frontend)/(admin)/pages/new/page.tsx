import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { PageForm } from "@/components/forms/PageForm"

export default async function NewTenantPage() {
  const { ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New page</h1>
      <PageForm tenantId={ctx.tenant.id} baseHref="/pages"/>
    </div>
  )
}

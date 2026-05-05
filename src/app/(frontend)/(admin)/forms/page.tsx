import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { listForms } from "@/lib/queries/forms"
import { FormsTable } from "@/components/tables/FormsTable"

export default async function TenantFormsPage() {
  const { ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const forms = await listForms(ctx.tenant.id)
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Forms</h1>
      <FormsTable data={forms.docs as any}/>
    </div>
  )
}

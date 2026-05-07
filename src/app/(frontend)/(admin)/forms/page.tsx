import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { listForms } from "@/lib/queries/forms"
import { FormsTable } from "@/components/tables/FormsTable"
import { PageHeader } from "@/components/layout/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Inbox } from "lucide-react"

export default async function TenantFormsPage() {
  const { ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const forms = await listForms(ctx.tenant.id)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Forms" />
      <FormsTable
        data={forms.docs as any}
        emptyState={
          <EmptyState
            icon={<Inbox className="h-10 w-10 text-muted-foreground" aria-hidden />}
            title="No submissions yet"
            description="When your forms receive submissions, they appear here."
          />
        }
      />
    </div>
  )
}

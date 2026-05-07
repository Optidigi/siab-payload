import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { listForms } from "@/lib/queries/forms"
import { FormsTable } from "@/components/tables/FormsTable"
import { PageHeader } from "@/components/layout/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Inbox } from "lucide-react"
import { notFound } from "next/navigation"

export default async function FormsPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const forms = await listForms(tenant.id)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Forms"
        tenant={{ name: tenant.name, slug: tenant.slug }}
      />
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

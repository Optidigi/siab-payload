import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { listForms } from "@/lib/queries/forms"
import { FormsTable } from "@/components/tables/FormsTable"
import { notFound } from "next/navigation"

export default async function FormsPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const forms = await listForms(tenant.id)
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Forms — {tenant.name}</h1>
      <FormsTable data={forms.docs as any} />
    </div>
  )
}

import { requireRole } from "@/lib/authGate"
import { TenantForm } from "@/components/forms/TenantForm"
import { PageHeader } from "@/components/page-header"

export default async function NewTenantPage() {
  await requireRole(["super-admin"])
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <PageHeader title="New tenant" />
      <TenantForm />
    </div>
  )
}

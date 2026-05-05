import { requireRole } from "@/lib/authGate"
import { TenantForm } from "@/components/forms/TenantForm"

export default async function NewTenantPage() {
  await requireRole(["super-admin"])
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-xl font-semibold">New tenant</h1>
      <TenantForm />
    </div>
  )
}

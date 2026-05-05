import { requireRole } from "@/lib/authGate"
import { listTenants } from "@/lib/queries/tenants"
import { TenantsTable } from "@/components/tables/TenantsTable"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function SitesPage() {
  await requireRole(["super-admin"])
  const tenants = await listTenants()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sites</h1>
        <Button asChild>
          <Link href="/sites/new"><Plus className="mr-1 h-4 w-4" /> New tenant</Link>
        </Button>
      </div>
      <TenantsTable data={tenants as any} />
    </div>
  )
}

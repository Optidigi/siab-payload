import { requireRole } from "@/lib/authGate"
import { listTenants } from "@/lib/queries/tenants"
import { TenantsTable } from "@/components/tables/TenantsTable"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import Link from "next/link"
import { Globe, Plus } from "lucide-react"

export default async function SitesPage() {
  await requireRole(["super-admin"])
  const tenants = await listTenants()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sites"
        action={
          <Button asChild>
            <Link href="/sites/new"><Plus className="mr-1 h-4 w-4" /> New tenant</Link>
          </Button>
        }
      />
      <TenantsTable
        data={tenants as any}
        emptyState={
          <EmptyState
            icon={<Globe className="h-10 w-10 text-muted-foreground" aria-hidden />}
            title="No tenants"
            description="Create your first tenant to get started."
            action={
              <Button asChild>
                <Link href="/sites/new"><Plus className="h-4 w-4 mr-1" /> New tenant</Link>
              </Button>
            }
          />
        }
      />
    </div>
  )
}

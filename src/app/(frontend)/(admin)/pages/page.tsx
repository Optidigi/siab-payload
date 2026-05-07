import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { listPages } from "@/lib/queries/pages"
import { PagesTable } from "@/components/tables/PagesTable"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/PageHeader"
import { Plus } from "lucide-react"
import Link from "next/link"

export default async function TenantPagesIndex() {
  const { ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const tenantId = ctx.tenant.id
  const pages = await listPages(tenantId)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pages"
        action={<Button asChild><Link href="/pages/new"><Plus className="mr-1 h-4 w-4"/> New page</Link></Button>}
      />
      <PagesTable data={pages as any} base="/pages"/>
    </div>
  )
}

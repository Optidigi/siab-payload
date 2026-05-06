import { getTenantBySlug } from "@/lib/queries/tenants"
import { getDashboardStats, getEditsTimeseries, getRecentActivity } from "@/lib/activity"
import { StatCards } from "@/components/dashboard/StatCards"
import { EditsChart } from "@/components/dashboard/EditsChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { StatusPill } from "@/components/shared/StatusPill"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireRole } from "@/lib/authGate"

export default async function TenantOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const tenantId = tenant.id

  const [stats, series, activity] = await Promise.all([
    getDashboardStats(tenantId),
    getEditsTimeseries(tenantId, 30),
    getRecentActivity({ tenantId, limit: 25 })
  ])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{tenant.name}</h1>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span>{tenant.domain}</span> · <StatusPill status={tenant.status as string} />
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/sites/${tenant.slug}/edit`}><Pencil className="mr-1 h-4 w-4"/> Edit tenant</Link>
        </Button>
      </div>
      <StatCards stats={[
        { label: "Published pages", value: stats.publishedPages },
        { label: "Edits this week", value: stats.editsThisWeek },
        { label: "Form submissions (30d)", value: stats.formsThisMonth },
        { label: "Status", value: tenant.status as string }
      ]} />
      <EditsChart data={series} />
      <ActivityFeed entries={activity} />
    </div>
  )
}

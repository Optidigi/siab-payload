import { requireAuth } from "@/lib/authGate"
import { getRecentActivity, getDashboardStats, getEditsTimeseries } from "@/lib/activity"
import { StatCards } from "@/components/dashboard/StatCards"
import { EditsChart } from "@/components/dashboard/EditsChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"

export default async function DashboardPage() {
  const { ctx } = await requireAuth()
  const tenantId = ctx.mode === "tenant" ? ctx.tenant.id : null

  const [stats, series, activity] = await Promise.all([
    getDashboardStats(tenantId),
    getEditsTimeseries(tenantId, 30),
    getRecentActivity({ tenantId, limit: 25 })
  ])

  return (
    <div className="flex flex-col gap-4">
      <StatCards stats={[
        { label: ctx.mode === "tenant" ? "Active site" : "Total tenants", value: stats.tenants },
        { label: "Published pages", value: stats.publishedPages },
        { label: "Edits this week", value: stats.editsThisWeek },
        { label: "Form submissions (30d)", value: stats.formsThisMonth }
      ]}/>
      <EditsChart data={series} />
      <ActivityFeed entries={activity} />
    </div>
  )
}

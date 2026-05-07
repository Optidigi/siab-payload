import { requireAuth } from "@/lib/authGate"
import { getRecentActivity, getDashboardStats, getEditsTimeseries } from "@/lib/activity"
import { StatCards } from "@/components/dashboard/StatCards"
import { EditsChart } from "@/components/dashboard/EditsChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { Globe, FileCheck2, Activity, Inbox } from "lucide-react"

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
        { label: ctx.mode === "tenant" ? "Active site" : "Total tenants", value: stats.tenants, icon: Globe },
        { label: "Published pages", value: stats.publishedPages, icon: FileCheck2 },
        { label: "Edits this week", value: stats.editsThisWeek, icon: Activity },
        { label: "Form submissions (30d)", value: stats.formsThisMonth, icon: Inbox }
      ]}/>
      <EditsChart data={series} />
      <ActivityFeed entries={activity} />
    </div>
  )
}

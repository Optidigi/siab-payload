import type { Metadata } from "next"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { getDashboardStats, getEditsTimeseries, getRecentActivity } from "@/lib/activity"
import { StatCards } from "@/components/dashboard/StatCards"
import { EditsChart } from "@/components/dashboard/EditsChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { StatusPill } from "@/components/shared/StatusPill"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/PageHeader"
import { Pencil, FileCheck2, Activity, Inbox, BadgeCheck } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireRole } from "@/lib/authGate"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  return { title: tenant?.name ?? "Tenant" }
}

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
      <PageHeader
        title={tenant.name}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span>{tenant.domain}</span> · <StatusPill status={tenant.status as string} />
          </span>
        }
        action={
          <Button asChild variant="outline">
            <Link href={`/sites/${tenant.slug}/edit`}><Pencil className="mr-1 h-4 w-4"/> Edit tenant</Link>
          </Button>
        }
      />
      <StatCards stats={[
        { label: "Published pages", value: stats.publishedPages, icon: FileCheck2 },
        { label: "Edits this week", value: stats.editsThisWeek, icon: Activity },
        { label: "Form submissions (30d)", value: stats.formsThisMonth, icon: Inbox },
        { label: "Status", value: tenant.status as string, icon: BadgeCheck }
      ]} />
      <EditsChart data={series} />
      <ActivityFeed entries={activity} />
    </div>
  )
}

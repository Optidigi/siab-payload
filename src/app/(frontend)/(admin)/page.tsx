import { requireAuth } from "@/lib/authGate"
import { getRecentActivity, getDashboardStats, getEditsTimeseries } from "@/lib/activity"
import { StatCards } from "@/components/dashboard/StatCards"
import { EditsChart } from "@/components/dashboard/EditsChart"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Globe, FileCheck2, Activity, Inbox, ShieldAlert } from "lucide-react"

// FN-2026-0035 — `requireRole` redirects to /?error=forbidden on access
// failures; pre-fix the dashboard ignored the param. Surface a friendly
// inline alert so the operator knows WHY they ended up here. Sibling of
// the LoginForm error-copy fix (FN-2026-0043).
const ERROR_COPY: Record<string, string> = {
  forbidden:
    "You don't have permission to access that page. You've been redirected to your dashboard."
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const { ctx } = await requireAuth()
  const tenantId = ctx.mode === "tenant" ? ctx.tenant.id : null
  const params = (await searchParams) ?? {}
  const errorCopy = params.error ? ERROR_COPY[params.error] : null

  const [stats, series, activity] = await Promise.all([
    getDashboardStats(tenantId),
    getEditsTimeseries(tenantId, 30),
    getRecentActivity({ tenantId, limit: 25 })
  ])

  return (
    <div className="flex flex-col gap-4">
      {errorCopy && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>{errorCopy}</AlertDescription>
        </Alert>
      )}
      <StatCards stats={[
        // FN-2026-0045 — wire href so cards become drill-down affordances.
        // CRITICAL: tenant-mode operators (owner/editor/viewer) must NOT
        // be linked to the /sites/[slug]/* super-admin tenant subroutes
        // (those gate with `requireRole(["super-admin"])` and would
        // bounce to /?error=forbidden — exactly the regression the
        // fn-batch-6 reviewer caught). For tenant-mode users the canonical
        // routes are the slugless host-resolved pages: /pages, /forms,
        // /media, /settings, /users. For super-admin at workspace top-
        // level the natural drill-downs are the global /sites + /users.
        {
          label: ctx.mode === "tenant" ? "Active site" : "Total tenants",
          value: stats.tenants,
          icon: Globe,
          // Tenant mode: leave the active-site card non-interactive (the
          // dashboard IS the active-site landing). Super-admin: drill
          // into the global tenants list.
          href: ctx.mode === "tenant" ? undefined : "/sites"
        },
        {
          label: "Published pages",
          value: stats.publishedPages,
          icon: FileCheck2,
          href: ctx.mode === "tenant" ? "/pages" : undefined
        },
        { label: "Edits this week", value: stats.editsThisWeek, icon: Activity },
        {
          label: "Form submissions (30d)",
          value: stats.formsThisMonth,
          icon: Inbox,
          href: ctx.mode === "tenant" ? "/forms" : undefined
        }
      ]}/>
      <EditsChart data={series} />
      <ActivityFeed entries={activity} mode={ctx.mode} />
    </div>
  )
}

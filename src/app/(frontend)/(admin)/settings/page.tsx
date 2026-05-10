import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { SettingsForm } from "@/components/forms/SettingsForm"
import { PageHeader } from "@/components/page-header"

export default async function TenantSettingsPage() {
  const { user, ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const settings = await getOrCreateSiteSettings(ctx.tenant.id)
  const canEdit = user.role === "owner"
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Settings" />
      <SettingsForm initial={settings} canEdit={canEdit}/>
    </div>
  )
}

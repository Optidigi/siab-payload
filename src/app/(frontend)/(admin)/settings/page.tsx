import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { SettingsForm } from "@/components/forms/SettingsForm"

export default async function TenantSettingsPage() {
  const { user, ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const settings = await getOrCreateSiteSettings(ctx.tenant.id)
  const canEdit = user.role === "owner"
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsForm initial={settings} canEdit={canEdit}/>
    </div>
  )
}

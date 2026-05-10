import { requireAuth } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { SettingsForm } from "@/components/forms/SettingsForm"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { notFound } from "next/navigation"

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { user } = await requireAuth()
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const settings = await getOrCreateSiteSettings(tenant.id)
  const canEdit = user.role === "super-admin" || user.role === "owner"
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Settings"
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
      />
      <SettingsForm initial={settings} canEdit={canEdit} />
    </div>
  )
}

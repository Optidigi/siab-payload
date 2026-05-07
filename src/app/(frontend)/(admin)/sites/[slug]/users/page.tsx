import { requireAuth } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { listUsersForTenant } from "@/lib/queries/users"
import { UsersTable } from "@/components/tables/UsersTable"
import { UserInviteForm } from "@/components/forms/UserInviteForm"
import { PageHeader } from "@/components/layout/PageHeader"
import { notFound } from "next/navigation"

export default async function TenantUsersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { user } = await requireAuth()
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const users = await listUsersForTenant(tenant.id)
  const canManage = user.role === "super-admin" || user.role === "owner"
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Team"
        tenant={{ name: tenant.name, slug: tenant.slug }}
        action={canManage ? <UserInviteForm tenantId={tenant.id} /> : undefined}
      />
      <UsersTable data={users as any} canManage={canManage} />
    </div>
  )
}

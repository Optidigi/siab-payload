import { requireAuth } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { listUsersForTenant } from "@/lib/queries/users"
import { UsersTable } from "@/components/tables/UsersTable"
import { UserInviteForm } from "@/components/forms/UserInviteForm"
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Team — {tenant.name}</h1>
        {canManage && <UserInviteForm tenantId={tenant.id} />}
      </div>
      <UsersTable data={users as any} canManage={canManage} />
    </div>
  )
}

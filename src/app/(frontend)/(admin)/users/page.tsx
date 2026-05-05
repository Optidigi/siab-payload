import { requireAuth } from "@/lib/authGate"
import { listAllUsers, listUsersForTenant } from "@/lib/queries/users"
import { UsersTable } from "@/components/tables/UsersTable"
import { UserInviteForm } from "@/components/forms/UserInviteForm"

export default async function UsersPage() {
  const { user, ctx } = await requireAuth()

  if (ctx.mode === "super-admin") {
    const users = await listAllUsers()
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">All users</h1>
        <UsersTable data={users as any} canManage />
      </div>
    )
  }

  // ctx.mode === "tenant" — tenant team page
  const tenantId = ctx.tenant.id
  const users = await listUsersForTenant(tenantId)
  const canManage = user.role === "owner"
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Team</h1>
        {canManage && <UserInviteForm tenantId={tenantId} />}
      </div>
      <UsersTable data={users as any} canManage={canManage} />
    </div>
  )
}

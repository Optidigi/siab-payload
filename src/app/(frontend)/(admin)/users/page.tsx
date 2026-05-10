import { requireAuth } from "@/lib/authGate"
import { listAllUsers, listUsersForTenant } from "@/lib/queries/users"
import { UsersTable } from "@/components/tables/UsersTable"
import { UserInviteForm } from "@/components/forms/UserInviteForm"
import { CreateUserForm } from "@/components/forms/CreateUserForm"
import { PageHeader } from "@/components/layout/PageHeader"
import { EmptyState } from "@/components/empty-state"
import { Users } from "lucide-react"

export default async function UsersPage() {
  const { user, ctx } = await requireAuth()

  if (ctx.mode === "super-admin") {
    const users = await listAllUsers()
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="All users"
          action={<CreateUserForm />}
        />
        <UsersTable
          data={users as any}
          canManage
          emptyState={
            <EmptyState
              icon={<Users className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title="No users"
              description="Provision a user account to grant access."
              action={<CreateUserForm />}
            />
          }
        />
      </div>
    )
  }

  // ctx.mode === "tenant" — tenant team page
  const tenantId = ctx.tenant.id
  const users = await listUsersForTenant(tenantId)
  const canManage = user.role === "owner"
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Team"
        action={canManage ? <UserInviteForm tenantId={tenantId} /> : undefined}
      />
      <UsersTable
        data={users as any}
        canManage={canManage}
        emptyState={
          <EmptyState
            icon={<Users className="h-10 w-10 text-muted-foreground" aria-hidden />}
            title="No team members yet"
            description="Invite your first team member to collaborate on this site."
            action={canManage ? <UserInviteForm tenantId={tenantId} /> : undefined}
          />
        }
      />
    </div>
  )
}

import { requireAuth } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { listUsersForTenant } from "@/lib/queries/users"
import { UsersTable } from "@/components/tables/UsersTable"
import { UserInviteForm } from "@/components/forms/UserInviteForm"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { EmptyState } from "@/components/empty-state"
import { Users } from "lucide-react"
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
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
        action={canManage ? <UserInviteForm tenantId={tenant.id} /> : undefined}
      />
      <UsersTable
        data={users as any}
        canManage={canManage}
        emptyState={
          <EmptyState
            icon={<Users className="h-10 w-10 text-muted-foreground" aria-hidden />}
            title="No team members yet"
            description="Invite your first team member to collaborate on this site."
            action={canManage ? <UserInviteForm tenantId={tenant.id} /> : undefined}
          />
        }
      />
    </div>
  )
}

import { requireRole } from "@/lib/authGate"
import { listTenants } from "@/lib/queries/tenants"
import { UserEditForm } from "@/components/forms/UserEditForm"
import { notFound } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"
import type { User } from "@/payload-types"

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  // Super-admin OR owner can reach this page; the API access layer
  // (canManageUsers in src/access/canManageUsers.ts) further restricts what
  // any given role can actually save (owner can only edit users in their
  // own tenant). Editor/viewer can never reach the edit URL.
  await requireRole(["super-admin", "owner"])

  const { id } = await params
  const payload = await getPayload({ config })

  let user: User
  try {
    user = await payload.findByID({
      collection: "users",
      id,
      overrideAccess: true,
      depth: 1
    }) as User
  } catch {
    notFound()
  }

  // Tenant list for the role-conditional tenant select. listTenants returns
  // already-unwrapped docs (limit: 200) — fine since real tenant counts stay
  // small and the select is a flat shadcn dropdown.
  const tenants = await listTenants()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Edit user</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>
      <UserEditForm
        // Force a fresh form mount when navigating between user IDs (defense
        // in depth — the route segment unmounts on its own today).
        key={user.id}
        user={user}
        tenants={tenants as Array<{ id: number | string; name: string; slug: string }>}
      />
    </div>
  )
}

import { requireRole } from "@/lib/authGate"
import { listAllUsers } from "@/lib/queries/users"
import { UsersTable } from "@/components/tables/UsersTable"

export default async function GlobalUsersPage() {
  await requireRole(["super-admin"])
  const users = await listAllUsers()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">All users</h1>
      <UsersTable data={users as any} canManage />
    </div>
  )
}

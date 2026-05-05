"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./DataTable"
import { RoleBadge } from "@/components/shared/RoleBadge"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { User } from "@/payload-types"

export function UsersTable({ data, canManage }: { data: User[]; canManage: boolean }) {
  const router = useRouter()

  const remove = async (u: User) => {
    if (!confirm(`Remove ${u.email}?`)) return
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Delete failed"); return }
    toast.success("Removed")
    router.refresh()
  }

  const cols: ColumnDef<User, any>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "role", header: "Role", cell: ({ getValue }) => <RoleBadge role={getValue() as string} /> },
    ...(canManage
      ? ([{
          id: "actions",
          header: "",
          cell: ({ row }: any) => (
            <Button size="icon" variant="ghost" type="button" onClick={() => remove(row.original)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )
        }] as ColumnDef<User, any>[])
      : [])
  ]
  return <DataTable columns={cols} data={data} filterColumn="email" filterPlaceholder="Filter users..." />
}

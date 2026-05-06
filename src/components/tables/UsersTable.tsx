"use client"
import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./DataTable"
import { RoleBadge } from "@/components/shared/RoleBadge"
import { TypedConfirmDialog } from "@/components/shared/TypedConfirmDialog"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { User } from "@/payload-types"

export function UsersTable({ data, canManage }: { data: User[]; canManage: boolean }) {
  const router = useRouter()
  // Holds the user the operator clicked the trash icon on; controls the
  // typed-confirm dialog. Single shared instance keeps state minimal.
  const [target, setTarget] = useState<User | null>(null)

  const remove = async () => {
    if (!target) return
    const res = await fetch(`/api/users/${target.id}`, { method: "DELETE" })
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      throw new Error(`Delete failed (${res.status}): ${txt.slice(0, 200)}`)
    }
    toast.success(`Removed ${target.email}`)
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
            <Button
              size="icon"
              variant="ghost"
              type="button"
              aria-label={`Remove ${row.original.email}`}
              onClick={() => setTarget(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )
        }] as ColumnDef<User, any>[])
      : [])
  ]

  return (
    <>
      <DataTable columns={cols} data={data} filterColumn="email" filterPlaceholder="Filter users..." />
      {target && (
        <TypedConfirmDialog
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          title="Remove user"
          description={
            <>
              This permanently removes <strong>{target.email}</strong>'s account and revokes
              their access to every tenant they belong to. The user record cannot be restored.
            </>
          }
          confirmPhrase={target.email}
          confirmLabel="Remove user"
          onConfirm={remove}
        />
      )}
    </>
  )
}

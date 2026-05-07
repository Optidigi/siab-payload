"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./DataTable"
import { RoleBadge } from "@/components/shared/RoleBadge"
import { TypedConfirmDialog } from "@/components/shared/TypedConfirmDialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { User } from "@/payload-types"

export function UsersTable({ data, canManage, emptyState }: { data: User[]; canManage: boolean; emptyState?: React.ReactNode }) {
  const router = useRouter()
  // Single shared dialog target — set when the operator picks Delete from
  // a row's kebab menu.
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
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => row.original.name || row.original.email,
      meta: { mobilePriority: "primary" }
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <a
          href={`mailto:${row.original.email}`}
          className="hover:underline truncate"
          dir="ltr"
          title={row.original.email}
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.email}
        </a>
      ),
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ getValue }) => <RoleBadge role={getValue() as string} />,
      meta: { mobilePriority: "secondary" }
    },
    ...(canManage
      ? ([{
          id: "actions",
          header: "",
          meta: { mobilePriority: "action" },
          cell: ({ row }: any) => {
            const u = row.original as User
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    type="button"
                    aria-label={`Actions for ${u.email}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem asChild>
                    <Link href={`/users/${u.id}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(e) => {
                      e.preventDefault()
                      setTarget(u)
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
        }] as ColumnDef<User, any>[])
      : [])
  ]

  return (
    <>
      <DataTable columns={cols} data={data} filterColumn="email" filterPlaceholder="Filter users..." emptyState={emptyState} />
      {target && (
        <TypedConfirmDialog
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          title="Remove user"
          description={
            <>
              This permanently removes <strong>{target.email}</strong>&apos;s account and revokes
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

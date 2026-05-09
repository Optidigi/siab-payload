"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./DataTable"
import { StatusPill } from "@/components/shared/StatusPill"
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
import { relativeTime } from "@/lib/relativeTime"
import type { Tenant } from "@/payload-types"

export function TenantsTable({ data, emptyState }: { data: Tenant[]; emptyState?: React.ReactNode }) {
  const router = useRouter()
  const [target, setTarget] = useState<Tenant | null>(null)

  const onDelete = async () => {
    if (!target) return
    const res = await fetch(`/api/tenants/${target.id}`, { method: "DELETE" })
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      throw new Error(`Delete failed (${res.status}): ${txt.slice(0, 200)}`)
    }
    toast.success(`Deleted ${target.name}`)
    router.refresh()
  }

  const cols: ColumnDef<Tenant, any>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Link href={`/sites/${row.original.slug}`} className="font-medium hover:underline">
          {row.getValue("name") as string}
        </Link>
      ),
      meta: { mobilePriority: "primary" }
    },
    {
      accessorKey: "domain",
      header: "Domain",
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "slug",
      header: "Slug",
      cell: ({ getValue }) => <code className="text-xs">{getValue() as string}</code>,
      meta: { mobilePriority: "hidden" }
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusPill status={getValue() as string} />,
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      cell: ({ getValue }) => relativeTime(getValue() as string),
      meta: { mobilePriority: "secondary" }
    },
    {
      id: "actions",
      header: "",
      meta: { mobilePriority: "action" },
      cell: ({ row }) => {
        const t = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                type="button"
                aria-label={`Actions for ${t.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href={`/sites/${t.slug}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  // Prevent the menu from closing AND swallowing the click;
                  // we want the dialog to take over.
                  e.preventDefault()
                  setTarget(t)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]

  return (
    <>
      <DataTable
        columns={cols}
        data={data}
        filterColumn="name"
        filterPlaceholder="Filter tenants..."
        emptyState={emptyState}
        getRowHref={(t) => `/sites/${t.slug}`}
      />
      {target && (
        <TypedConfirmDialog
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          title={`Delete ${target.name}`}
          description={
            <>
              Permanently deletes tenant <strong>{target.name}</strong> ({target.domain}) and
              cascade-deletes its pages, media, forms, settings, and on-disk dir.{" "}
              <strong>Irreversible.</strong>
            </>
          }
          confirmPhrase={target.slug}
          confirmLabel="Delete tenant"
          onConfirm={onDelete}
        />
      )}
    </>
  )
}

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
import { parsePayloadError } from "@/lib/api"
import { relativeTime } from "@/lib/relativeTime"
import type { Page } from "@/payload-types"

export function PagesTable({ data, base, emptyState }: { data: Page[]; base: string; emptyState?: React.ReactNode }) {
  const router = useRouter()
  const [target, setTarget] = useState<Page | null>(null)

  const onDelete = async () => {
    if (!target) return
    const res = await fetch(`/api/pages/${target.id}`, { method: "DELETE" })
    if (!res.ok) {
      const detail = await parsePayloadError(res)
      throw new Error(detail.message)
    }
    toast.success(`Deleted ${target.title}`)
    setTarget(null)
    router.refresh()
  }

  const cols: ColumnDef<Page, any>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <Link href={`${base}/${row.original.id}`} className="font-medium hover:underline">
          {row.getValue("title") as string}
        </Link>
      ),
      meta: { mobilePriority: "primary" }
    },
    {
      accessorKey: "slug",
      header: "Slug",
      cell: ({ getValue }) => <code className="text-xs">{getValue() as string}</code>,
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusPill status={getValue() as string}/>,
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
        const p = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                type="button"
                aria-label={`Actions for ${p.title}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href={`${base}/${p.id}`}>
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
                  setTarget(p)
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
        filterColumn="title"
        filterPlaceholder="Filter pages..."
        emptyState={emptyState}
        getRowHref={(p) => `${base}/${p.id}`}
      />
      {target && (
        <TypedConfirmDialog
          open={!!target}
          onOpenChange={(o) => !o && setTarget(null)}
          title={`Delete ${target.title}`}
          description={
            <>
              This will permanently delete the page <strong>{target.title}</strong> and remove
              it from the live site. <strong>Cannot be undone.</strong>
            </>
          }
          confirmPhrase={target.slug}
          confirmLabel="Delete page"
          onConfirm={onDelete}
        />
      )}
    </>
  )
}

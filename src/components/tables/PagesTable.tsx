"use client"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./DataTable"
import { StatusPill } from "@/components/shared/StatusPill"
import { relativeTime } from "@/lib/relativeTime"
import type { Page } from "@/payload-types"

export function PagesTable({ data, base }: { data: Page[]; base: string }) {
  const cols: ColumnDef<Page, any>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <Link href={`${base}/${row.original.id}`} className="font-medium hover:underline">
          {row.getValue("title") as string}
        </Link>
      )
    },
    { accessorKey: "slug", header: "Slug", cell: ({ getValue }) => <code className="text-xs">{getValue() as string}</code> },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue() as string}/> },
    { accessorKey: "updatedAt", header: "Updated", cell: ({ getValue }) => relativeTime(getValue() as string) }
  ]
  return <DataTable columns={cols} data={data} filterColumn="title" filterPlaceholder="Filter pages..." />
}

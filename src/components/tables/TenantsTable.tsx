"use client"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./DataTable"
import { StatusPill } from "@/components/shared/StatusPill"
import type { Tenant } from "@/payload-types"

const cols: ColumnDef<Tenant, any>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link href={`/sites/${row.original.slug}`} className="font-medium hover:underline">
        {row.getValue("name") as string}
      </Link>
    )
  },
  { accessorKey: "domain", header: "Domain" },
  {
    accessorKey: "slug",
    header: "Slug",
    cell: ({ getValue }) => <code className="text-xs">{getValue() as string}</code>
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => <StatusPill status={getValue() as string} />
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString()
  }
]

export function TenantsTable({ data }: { data: Tenant[] }) {
  return <DataTable columns={cols} data={data} filterColumn="name" filterPlaceholder="Filter tenants..." />
}

"use client"
import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "./DataTable"
import { StatusPill } from "@/components/shared/StatusPill"
import { relativeTime } from "@/lib/relativeTime"
import { FormSubmissionSheet } from "@/components/forms/FormSubmissionSheet"
import type { Form as FormDoc } from "@/payload-types"

export function FormsTable({ data }: { data: FormDoc[] }) {
  const [active, setActive] = useState<FormDoc | null>(null)

  const cols: ColumnDef<FormDoc, any>[] = [
    { accessorKey: "createdAt", header: "When", cell: ({ getValue }) => relativeTime(getValue() as string) },
    { accessorKey: "email", header: "From" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "formName", header: "Form" },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue() as string} /> }
  ]

  return (
    <>
      {/* DataTable rows already have data-id attributes; we capture row clicks to open the sheet */}
      <div onClick={(e) => {
        const tr = (e.target as HTMLElement).closest("tr[data-id]") as HTMLElement | null
        if (!tr) return
        const id = tr.dataset.id
        if (!id) return
        const found = data.find((d) => String(d.id) === id)
        if (found) setActive(found)
      }}>
        <DataTable columns={cols} data={data} filterColumn="email" filterPlaceholder="Filter by email..." />
      </div>
      <FormSubmissionSheet form={active} open={!!active} onOpenChange={(b) => !b && setActive(null)} />
    </>
  )
}

"use client"
import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { statusVariant } from "@/lib/badge-helpers"
import { relativeTime } from "@/lib/relativeTime"
import { FormSubmissionSheet } from "@/components/forms/FormSubmissionSheet"
import type { Form as FormDoc } from "@/payload-types"

export function FormsTable({ data, emptyState }: { data: FormDoc[]; emptyState?: React.ReactNode }) {
  const [active, setActive] = useState<FormDoc | null>(null)

  const cols: ColumnDef<FormDoc, any>[] = [
    {
      accessorKey: "createdAt",
      header: "When",
      cell: ({ getValue }) => relativeTime(getValue() as string),
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "email",
      header: "From",
      meta: { mobilePriority: "primary" }
    },
    {
      accessorKey: "name",
      header: "Name",
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "formName",
      header: "Form",
      meta: { mobilePriority: "secondary" }
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => { const s = getValue() as string; return <Badge variant={statusVariant(s)}><span className="size-1.5 rounded-full bg-current" aria-hidden />{s}</Badge> },
      meta: { mobilePriority: "secondary" }
    }
  ]

  return (
    <>
      {/* DataTable rows already have data-id attributes; we capture row clicks to open the sheet */}
      <div onClick={(e) => {
        const el = (e.target as HTMLElement).closest("[data-id]") as HTMLElement | null
        if (!el) return
        const id = el.dataset.id
        if (!id) return
        const found = data.find((d) => String(d.id) === id)
        if (found) setActive(found)
      }}>
        <DataTable columns={cols} data={data} filterColumn="email" filterPlaceholder="Filter by email..." emptyState={emptyState} />
      </div>
      <FormSubmissionSheet form={active} open={!!active} onOpenChange={(b) => !b && setActive(null)} />
    </>
  )
}

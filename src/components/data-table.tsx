"use client"
import {
  type ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, type SortingState, useReactTable
} from "@tanstack/react-table"
import { useState } from "react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, FileQuestion, Search, X } from "lucide-react"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"

type Props<T> = {
  columns: ColumnDef<T, any>[]
  data: T[]
  filterColumn?: string
  filterPlaceholder?: string
  emptyState?: React.ReactNode
  getRowHref?: (row: T) => string
}

export function DataTable<T>({ columns, data, filterColumn, filterPlaceholder, emptyState, getRowHref }: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [filter, setFilter] = useState("")

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  const isEmpty = table.getRowModel().rows.length === 0
  // Distinguish "list is empty" (show caller-supplied empty state with
  // primary CTA like "+ New page") from "filter narrowed to zero rows"
  // (always show the generic "No results / adjust your search" state).
  // Without this, filtering a populated list to 0 results displays the
  // wrong copy ("No pages yet — create your first page").
  const isFilterNarrowed = isEmpty && data.length > 0

  return (
    <div className="space-y-3">
      {filterColumn && (
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            placeholder={filterPlaceholder ?? "Search…"}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            inputMode="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            className="pl-8 pr-9"
          />
          {!!filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {isEmpty ? (
        isFilterNarrowed ? (
          <EmptyState
            icon={<FileQuestion className="h-10 w-10 text-muted-foreground" aria-hidden />}
            title="No results"
            description="Try adjusting your search or filter."
          />
        ) : (
          emptyState ?? (
            <EmptyState
              icon={<FileQuestion className="h-10 w-10 text-muted-foreground" aria-hidden />}
              title="No results"
              description="Try adjusting your search or filter."
            />
          )
        )
      ) : (
        <>
          {/* Phone card view */}
          <div className="md:hidden flex flex-col gap-2">
            {table.getRowModel().rows.map((row) => {
              const cells = row.getVisibleCells()
              const primary = cells.find((c) => c.column.columnDef.meta?.mobilePriority === "primary")
              const action = cells.find((c) => c.column.columnDef.meta?.mobilePriority === "action")
              const secondary = cells.filter((c) => {
                const p = c.column.columnDef.meta?.mobilePriority
                return p !== "primary" && p !== "action" && p !== "hidden"
              })
              const href = getRowHref?.(row.original)
              return (
                <Card
                  key={row.id}
                  data-id={(row.original as any).id}
                  className={cn(
                    "p-3 flex items-start gap-2 transition-shadow",
                    href && "relative hover:shadow-md active:scale-[0.99]",
                  )}
                >
                  {href && (
                    <Link
                      href={href}
                      className="absolute inset-0 z-0 rounded-[inherit]"
                      aria-label="Open"
                    />
                  )}
                  <div
                    className={cn(
                      "flex-1 min-w-0 space-y-1",
                      href && "relative z-[1] pointer-events-none",
                    )}
                  >
                    {primary && (
                      <div
                        className={cn(
                          "font-medium truncate",
                          href && "[&_a]:pointer-events-none [&_a]:text-inherit [&_a]:no-underline",
                        )}
                      >
                        {flexRender(primary.column.columnDef.cell, primary.getContext())}
                      </div>
                    )}
                    {secondary.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {secondary.map((cell, i) => (
                          <span key={cell.id} className="truncate inline-flex items-center gap-1">
                            {i > 0 && <span aria-hidden>·</span>}
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {action && (
                    <div
                      className={cn(
                        "shrink-0",
                        href && "relative z-[2]",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {flexRender(action.column.columnDef.cell, action.getContext())}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((g) => (
                  <TableRow key={g.id}>
                    {g.headers.map((h) => (
                      <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((r) => (
                  <TableRow key={r.id} data-id={(r.original as any).id}>
                    {r.getVisibleCells().map((c) => (
                      <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {table.getPageCount() > 1 && (
        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-background/95 backdrop-blur px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {`Showing ${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–${Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )} of ${table.getFilteredRowModel().rows.length}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs text-muted-foreground">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

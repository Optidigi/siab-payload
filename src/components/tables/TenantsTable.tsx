"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { statusVariant } from "@/lib/badge-helpers"
import { TypedConfirmDialog } from "@/components/typed-confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { MoreVertical, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { relativeTime } from "@/lib/relativeTime"
import type { Tenant } from "@/payload-types"

// FN-2026-0041 — Path A (TenantsTable Actions Delete) used generic copy
// while Path B (TenantEditForm Danger zone) showed live cascade counts.
// Two paths to the same destructive action shouldn't differ in
// information density. Lazy-fetch counts when the dialog opens.
type Counts = { pages: number; media: number; forms: number; siteSettings: number }
async function fetchTenantCounts(tenantId: number | string): Promise<Counts> {
  // The count endpoint takes a where filter; bundle 4 parallel calls.
  // Pre-fix shape would have needed a dedicated /api/tenants/:id/counts
  // endpoint, but Payload's REST count surface is flexible enough that
  // we don't need to add one.
  const where = encodeURIComponent(JSON.stringify({ tenant: { equals: tenantId } }))
  const fetchOne = (collection: string) =>
    fetch(`/api/${collection}/count?where=${where}`).then((r) => r.json()).then((j) => j.totalDocs ?? 0)
  const [pages, media, forms, siteSettings] = await Promise.all([
    fetchOne("pages"),
    fetchOne("media"),
    fetchOne("forms"),
    fetchOne("site-settings")
  ])
  return { pages, media, forms, siteSettings }
}

export function TenantsTable({ data, emptyState }: { data: Tenant[]; emptyState?: React.ReactNode }) {
  const router = useRouter()
  const [target, setTarget] = useState<Tenant | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  // FN-2026-0041 — when the dialog opens, kick off a lazy counts fetch.
  // Reset on close so a subsequent re-open doesn't show stale data.
  useEffect(() => {
    if (!target) {
      setCounts(null)
      return
    }
    let cancelled = false
    fetchTenantCounts(target.id).then((c) => {
      if (!cancelled) setCounts(c)
    }).catch(() => {
      // Network failure — leave counts null; the dialog falls back to
      // generic copy below. Better than blocking the destructive action.
    })
    return () => { cancelled = true }
  }, [target])

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
      // FN-2026-0006 fix — DataTable's mobile-card branch wraps the row in
      // a `<Link aria-label="Open">`, so a nested `<Link>` in the Name cell
      // produced "<a> cannot be a descendant of <a>" hydration errors on
      // every page load. Render the cell as a plain `<span>` on mobile (the
      // row Link captures the click) and `<Link>` on desktop where there's
      // no row wrapper. Both branches sit in the DOM gated by Tailwind
      // `md:hidden` / `hidden md:inline`; the inactive one has display:none
      // so it's removed from the accessibility tree (no double-announce).
      cell: ({ row }) => {
        const name = row.getValue("name") as string
        return (
          <>
            <span className="md:hidden font-medium">{name}</span>
            <Link href={`/sites/${row.original.slug}`} className="hidden md:inline font-medium hover:underline">
              {name}
            </Link>
          </>
        )
      },
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
      cell: ({ getValue }) => { const s = getValue() as string; return <Badge variant={statusVariant(s)}><span className="size-1.5 rounded-full bg-current" aria-hidden />{s}</Badge> },
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
                <MoreVertical className="h-4 w-4" />
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
            counts ? (
              <>
                About to delete tenant <strong>{target.name}</strong> ({target.domain}). This
                cascade-deletes <strong>{counts.pages}</strong> page{counts.pages === 1 ? "" : "s"},{" "}
                <strong>{counts.media}</strong> media file{counts.media === 1 ? "" : "s"},{" "}
                <strong>{counts.forms}</strong> form submission{counts.forms === 1 ? "" : "s"}, and removes the tenant&apos;s
                on-disk dir. <strong>Irreversible.</strong>
              </>
            ) : (
              <>
                About to delete tenant <strong>{target.name}</strong> ({target.domain}). This
                cascade-deletes the tenant&apos;s pages, media, form submissions, settings, and on-disk dir.{" "}
                <span className="text-muted-foreground">Loading counts…</span>{" "}
                <strong>Irreversible.</strong>
              </>
            )
          }
          confirmPhrase={target.slug}
          confirmLabel="Delete tenant"
          onConfirm={onDelete}
        />
      )}
    </>
  )
}

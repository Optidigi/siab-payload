"use client"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { MediaUsageDialog } from "./MediaUsageDialog"
import { parsePayloadError } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Media } from "@/payload-types"
import type { MediaUsageEntry, MediaUsageMap } from "@/lib/queries/mediaUsageWalker"

/**
 * Grid of media cards. Two new behaviors over the previous version:
 *
 *  - Each card shows a "Used in N" badge when the item is referenced by
 *    pages or by site-settings. Clicking the badge opens MediaUsageDialog.
 *  - Delete uses ConfirmDialog instead of native confirm(). When the item
 *    is in use, the dialog description lists the dependents so the operator
 *    sees the impact before confirming.
 *  - In the management view (selectable=false), cards can be multi-selected
 *    via checkboxes; a sticky action bar enables bulk delete.
 */
export function MediaGrid({
  items,
  onSelect,
  selectable,
  onDeleted,
  usage,
  pagesBaseHref = "/pages"
}: {
  items: Media[]
  onSelect?: (m: Media) => void
  selectable?: boolean
  onDeleted?: () => void
  usage?: MediaUsageMap
  pagesBaseHref?: string
}) {
  const router = useRouter()
  const [confirmFor, setConfirmFor] = useState<Media | null>(null)
  const [usageFor, setUsageFor] = useState<Media | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set())
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)

  const usageOf = (m: Media): MediaUsageEntry => {
    // Map keys are `number | string` (the union of Payload id types — pg
    // adapter uses numbers, mongo uses strings). `Media.id` is the same
    // union per payload-types.ts, so no cast is needed.
    const entry = usage?.get(m.id as number | string)
    return entry ?? { pages: [], settings: false }
  }
  const usageCount = (m: Media) => {
    const e = usageOf(m)
    return e.pages.length + (e.settings ? 1 : 0)
  }

  const onConfirmDelete = async (m: Media) => {
    const res = await fetch(`/api/media/${m.id}`, { method: "DELETE" })
    if (!res.ok) {
      const { message } = await parsePayloadError(res)
      throw new Error(message || "Delete failed")
    }
    toast.success("Deleted")
    if (onDeleted) onDeleted()
    else router.refresh()
  }

  const onBulkDelete = async () => {
    // Parallel deletes via Promise.allSettled so 10+ items don't take 10×
    // the round-trip time of a single delete. allSettled (vs all) means
    // one failure doesn't abort the rest — partial-success is reported
    // via the toast count.
    const ids = Array.from(selectedIds)
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/media/${id}`, { method: "DELETE" }))
    )
    let okCount = 0
    let failCount = 0
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.ok) okCount++
      else failCount++
    }
    if (failCount === 0) toast.success(`Deleted ${okCount} item${okCount === 1 ? "" : "s"}`)
    else toast.error(`Deleted ${okCount}, failed ${failCount}`)
    setSelectedIds(new Set())
    if (onDeleted) onDeleted()
    else router.refresh()
  }

  // Build bulk-delete description
  const buildBulkDescription = () => {
    const ids = Array.from(selectedIds)
    const selectedItems = items.filter((m) => ids.includes(m.id as any))
    const MAX_NAMES = 5
    const shownNames = selectedItems.slice(0, MAX_NAMES).map((m) => m.filename ?? String(m.id))
    const extra = selectedItems.length - shownNames.length

    // Check if any selected item is referenced somewhere
    const hasRefs = selectedItems.some((m) => usageCount(m) > 0)

    return (
      <>
        <p>
          Permanently delete {ids.length} item{ids.length === 1 ? "" : "s"}:{" "}
          <strong>{shownNames.join(", ")}{extra > 0 ? ` and ${extra} more` : ""}</strong>.
        </p>
        {hasRefs && (
          <p className="mt-2 text-xs">
            Some of these files are referenced by pages. Those pages will show broken images until the references are replaced.
          </p>
        )}
      </>
    )
  }

  return (
    <>
      {!selectable && selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-md border bg-background/95 backdrop-blur px-3 py-2 mb-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              type="button"
              onClick={() => setBulkConfirmOpen(true)}
            >
              Delete {selectedIds.size}
            </Button>
          </div>
        </div>
      )}

      {/* FN-2026-0039 — empty-state. Pre-fix the grid rendered an empty
          div with no message, no Upload CTA. Show a friendly placeholder
          when there are no items so a fresh tenant communicates "no media
          yet" rather than "broken page". The PageHeader's Upload button
          remains the canonical upload affordance. */}
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          <div className="font-medium text-foreground">No media yet</div>
          <p className="mt-1">
            Upload images, video, or PDFs using the Upload button at the top of the page.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((m) => {
          const count = usageCount(m)
          const isSelected = !selectable && selectedIds.has(m.id as any)
          return (
            <Card
              key={m.id as any}
              className={cn(
                "relative",
                selectable && "cursor-pointer hover:ring-2 hover:ring-ring",
                !selectable && "cursor-pointer transition-colors",
                isSelected && "ring-2 ring-primary bg-primary/5",
              )}
              onClick={() => {
                if (selectable) {
                  onSelect?.(m)
                  return
                }
                // Management mode: tapping the card toggles selection.
                const next = new Set(selectedIds)
                if (next.has(m.id as any)) next.delete(m.id as any)
                else next.add(m.id as any)
                setSelectedIds(next)
              }}
            >
              {!selectable && (
                // Checkbox is now a pure visual indicator. Card click is the
                // sole interaction path — pointer-events-none avoids the
                // double-toggle that would otherwise happen when the click
                // hits both the checkbox and the card.
                <div className="absolute top-2 left-2 z-10 pointer-events-none">
                  <Checkbox
                    checked={isSelected}
                    aria-label={`${isSelected ? "Selected" : "Not selected"}: ${m.filename}`}
                  />
                </div>
              )}
              <CardContent className="p-2 space-y-2">
                {(m.mimeType ?? "").startsWith("image/")
                  ? <img src={m.url ?? ""} alt={m.alt ?? ""} className="aspect-video w-full object-cover rounded" />
                  : <div className="aspect-video flex items-center justify-center bg-muted text-xs text-muted-foreground rounded">{m.mimeType}</div>}
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs truncate min-w-0">
                    <div className="font-medium truncate">{m.filename}</div>
                    <div className="text-muted-foreground truncate">{m.alt ?? "—"}</div>
                    {usage && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setUsageFor(m) }}
                        className={`mt-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] ${count > 0 ? "border-primary/30 text-primary hover:bg-primary/5" : "border-border text-muted-foreground"}`}
                        aria-label={count > 0 ? `Used in ${count} ${count === 1 ? "place" : "places"}` : "Not used anywhere"}
                      >
                        {count > 0 ? `Used in ${count}` : "Unused"}
                      </button>
                    )}
                  </div>
                  {!selectable && (
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setConfirmFor(m) }}
                      aria-label={`Delete ${m.filename}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      )}

      {usageFor && (
        <MediaUsageDialog
          open={!!usageFor}
          onOpenChange={(o) => !o && setUsageFor(null)}
          filename={usageFor.filename ?? ""}
          pages={usageOf(usageFor).pages}
          settings={usageOf(usageFor).settings}
          pagesBaseHref={pagesBaseHref}
        />
      )}

      {confirmFor && (
        <ConfirmDialog
          open={!!confirmFor}
          onOpenChange={(o) => !o && setConfirmFor(null)}
          title="Delete media"
          description={
            <>
              This permanently removes <strong>{confirmFor.filename}</strong>.
              {(() => {
                const e = usageOf(confirmFor)
                const total = e.pages.length + (e.settings ? 1 : 0)
                if (total === 0) return <> It is not referenced anywhere.</>
                return (
                  <>
                    {" "}It is referenced by:
                    <ul className="mt-2 list-disc pl-5 text-xs">
                      {e.pages.map((p) => (
                        <li key={String(p.id)}>{p.title}{p.slug ? ` (/${p.slug})` : ""}</li>
                      ))}
                      {e.settings && <li>Site settings — branding logo</li>}
                    </ul>
                    <p className="mt-2 text-xs">
                      Pages referencing this file will show a broken image until you replace or remove it.
                    </p>
                  </>
                )
              })()}
            </>
          }
          confirmLabel="Delete"
          onConfirm={() => onConfirmDelete(confirmFor)}
        />
      )}

      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        title={`Delete ${selectedIds.size} media item${selectedIds.size === 1 ? "" : "s"}`}
        description={buildBulkDescription()}
        confirmLabel={`Delete ${selectedIds.size}`}
        onConfirm={onBulkDelete}
      />
    </>
  )
}

"use client"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { TypedConfirmDialog } from "@/components/shared/TypedConfirmDialog"
import { MediaUsageDialog } from "./MediaUsageDialog"
import { parsePayloadError } from "@/lib/api"
import type { Media } from "@/payload-types"
import type { MediaUsageEntry, MediaUsageMap } from "@/lib/queries/mediaUsageWalker"

/**
 * Grid of media cards. Two new behaviors over the previous version:
 *
 *  - Each card shows a "Used in N" badge when the item is referenced by
 *    pages or by site-settings. Clicking the badge opens MediaUsageDialog.
 *  - Delete uses TypedConfirmDialog (must type the filename) instead of
 *    native confirm(). When the item is in use, the dialog description
 *    lists the dependents so the operator sees the impact before typing.
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

  const usageOf = (m: Media): MediaUsageEntry => {
    const entry = usage?.get(m.id as any)
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

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((m) => {
          const count = usageCount(m)
          return (
            <Card key={m.id as any} className={selectable ? "cursor-pointer hover:ring-2 hover:ring-ring" : ""}>
              <CardContent className="p-2 space-y-2" onClick={() => selectable && onSelect?.(m)}>
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
        <TypedConfirmDialog
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
          confirmPhrase={confirmFor.filename ?? ""}
          confirmLabel="Delete media"
          onConfirm={() => onConfirmDelete(confirmFor)}
        />
      )}
    </>
  )
}

"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { Media } from "@/payload-types"

export function MediaGrid({
  items, onSelect, selectable, onDeleted
}: { items: Media[]; onSelect?: (m: Media) => void; selectable?: boolean; onDeleted?: () => void }) {
  const router = useRouter()

  const onDelete = async (m: Media) => {
    if (!confirm(`Delete ${m.filename}?`)) return
    const res = await fetch(`/api/media/${m.id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Delete failed"); return }
    toast.success("Deleted")
    if (onDeleted) onDeleted()
    else router.refresh()
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((m) => (
        <Card key={m.id as any} className={selectable ? "cursor-pointer hover:ring-2 hover:ring-ring" : ""}>
          <CardContent className="p-2 space-y-2" onClick={() => selectable && onSelect?.(m)}>
            {(m.mimeType ?? "").startsWith("image/")
              ? <img src={m.url ?? ""} alt={m.alt ?? ""} className="aspect-video w-full object-cover rounded" />
              : <div className="aspect-video flex items-center justify-center bg-muted text-xs text-muted-foreground rounded">{m.mimeType}</div>}
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs truncate min-w-0">
                <div className="font-medium truncate">{m.filename}</div>
                <div className="text-muted-foreground truncate">{m.alt ?? "—"}</div>
              </div>
              {!selectable && (
                <Button size="icon" variant="ghost" type="button" onClick={(e) => { e.stopPropagation(); onDelete(m) }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

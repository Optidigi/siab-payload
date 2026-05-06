"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { BLOCKS } from "@/blocks/registry"

/**
 * Block-type picker dialog.
 *
 * Two ways to use it:
 *
 *  - Default trigger (legacy "+ Add block" button): omit `controlledOpen`
 *    and `onOpenChange`. The picker renders its own outline button.
 *  - Programmatic (from an InsertSlot): pass `controlledOpen` and
 *    `onOpenChange` so the parent decides when to open it. In this case
 *    no trigger button is rendered.
 *
 * `onAdd(slug, atIndex)` lets the caller insert at an arbitrary index
 * rather than always appending. Pass any default index when controlled.
 */
export function BlockTypePicker({
  onAdd,
  defaultIndex,
  controlledOpen,
  onOpenChange
}: {
  onAdd: (slug: string, atIndex: number) => void
  // Optional — only meaningful in controlled mode (called from InsertSlot
  // with a specific insertion index). Trigger-only callers using the
  // default "+ Add block" button can omit it; the onAdd handler in
  // BlockEditor falls back to append() when atIndex >= fields.length, so
  // Number.MAX_SAFE_INTEGER reliably routes to "append at end".
  defaultIndex?: number
  controlledOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (o: boolean) => {
    if (isControlled) onOpenChange?.(o)
    else setInternalOpen(o)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" type="button">
            <Plus className="mr-1 h-4 w-4" /> Add block
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader><DialogTitle>Add a block</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {BLOCKS.map((b) => (
            <button
              key={b.slug}
              type="button"
              className="rounded-md border p-3 text-left hover:bg-accent"
              onClick={() => { onAdd(b.slug, defaultIndex ?? Number.MAX_SAFE_INTEGER); setOpen(false) }}
            >
              <div className="font-medium">{b.slug}</div>
              <div className="text-xs text-muted-foreground">{b.fields.length} fields</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

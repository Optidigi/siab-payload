"use client"
import { useState } from "react"
import { ChevronDown, ChevronRight, Trash2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldRenderer } from "./FieldRenderer"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useBlockKeyboardNav } from "./useBlockKeyboardNav"

export function BlockListItem({
  id,
  index,
  total,
  blockSlug,
  blockConfig,
  onRemove,
  onMove
}: {
  id: string
  index: number
  total: number
  blockSlug: string
  blockConfig: any
  onRemove: () => void
  onMove: (from: number, to: number) => void
}) {
  const [open, setOpen] = useState(true)
  const namePrefix = `blocks.${index}`

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const kbd = useBlockKeyboardNav({ index, total, move: onMove })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
      {...attributes}
      onKeyDown={kbd.onKeyDown}
      tabIndex={kbd.tabIndex}
      aria-label={`Block ${index + 1} of ${total}: ${blockSlug}`}
    >
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-muted-foreground"
            aria-label={open ? "Collapse block" : "Expand block"}
          >
            {open ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
          </button>
          <button
            type="button"
            className="cursor-grab text-muted-foreground touch-none active:cursor-grabbing"
            aria-label="Drag to reorder block"
            {...listeners}
          >
            <GripVertical className="h-4 w-4"/>
          </button>
          <span className="font-medium">{blockSlug}</span>
        </div>
        <Button variant="ghost" size="icon" type="button" onClick={onRemove} aria-label="Remove block">
          <Trash2 className="h-4 w-4"/>
        </Button>
      </div>
      {open && (
        <div className="border-t p-3 space-y-3">
          {blockConfig.fields.map((f: any, i: number) => (
            <FieldRenderer key={i} field={f} namePrefix={namePrefix} />
          ))}
        </div>
      )}
    </div>
  )
}

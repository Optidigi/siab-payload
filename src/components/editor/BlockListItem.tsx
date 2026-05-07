"use client"
import { useState } from "react"
import { ChevronDown, ChevronRight, Trash2, GripVertical, BookmarkPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldRenderer } from "./FieldRenderer"
import { SaveAsPresetDialog } from "./SaveAsPresetDialog"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useBlockKeyboardNav } from "./useBlockKeyboardNav"
import { useWatch, useFormContext } from "react-hook-form"

export function BlockListItem({
  id,
  index,
  total,
  blockSlug,
  blockConfig,
  tenantId,
  onRemove,
  onMove
}: {
  id: string
  index: number
  total: number
  blockSlug: string
  blockConfig: any
  // Forwarded to SaveAsPresetDialog so the POST body carries the tenant
  // (the multi-tenant plugin requires it on creates for super-admin users).
  tenantId: number | string
  onRemove: () => void
  onMove: (from: number, to: number) => void
}) {
  const [open, setOpen] = useState(true)
  const [saveAsPresetOpen, setSaveAsPresetOpen] = useState(false)
  const namePrefix = `blocks.${index}`

  const { control } = useFormContext()
  const values = useWatch({ control, name: `blocks.${index}` }) as Record<string, unknown> | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryText = (blockConfig as any)?.summary?.(values ?? {}) as string | undefined

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
          <span className="font-medium">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(blockConfig as any)?.labels?.singular ?? blockSlug}
          </span>
          {summaryText && (
            <span className="ml-2 text-xs text-muted-foreground truncate min-w-0">
              · {summaryText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => setSaveAsPresetOpen(true)}
            aria-label="Save block as preset"
          >
            <BookmarkPlus className="h-4 w-4"/>
          </Button>
          <Button variant="ghost" size="icon" type="button" onClick={onRemove} aria-label="Remove block">
            <Trash2 className="h-4 w-4"/>
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t p-3 space-y-3">
          {blockConfig.fields.map((f: any, i: number) => (
            <FieldRenderer key={i} field={f} namePrefix={namePrefix} />
          ))}
        </div>
      )}
      <SaveAsPresetDialog
        open={saveAsPresetOpen}
        onOpenChange={setSaveAsPresetOpen}
        blockIndex={index}
        blockSlug={blockSlug}
        tenantId={tenantId}
      />
    </div>
  )
}

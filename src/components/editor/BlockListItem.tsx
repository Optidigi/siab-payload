"use client"
import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Trash2, GripVertical, BookmarkPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldRenderer } from "./FieldRenderer"
import { SaveAsPresetDialog } from "./SaveAsPresetDialog"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useBlockKeyboardNav } from "./useBlockKeyboardNav"
import { useWatch, useFormContext } from "react-hook-form"
import { blockBySlug } from "@/blocks/registry"
import type { BlockWithMeta } from "@/blocks/_summary"

function getSessionKey(pageId: string | number, blockFieldId: string) {
  return `block-open:${pageId}:${blockFieldId}`
}

export function BlockListItem({
  id,
  index,
  total,
  blockSlug,
  blockConfig,
  tenantId,
  onRemove,
  onMove,
  isPhone,
  pageId,
  blockFieldId,
}: {
  id: string
  index: number
  total: number
  blockSlug: string
  blockConfig: BlockWithMeta
  // Forwarded to SaveAsPresetDialog so the POST body carries the tenant
  // (the multi-tenant plugin requires it on creates for super-admin users).
  tenantId: number | string
  onRemove: () => void
  onMove: (from: number, to: number) => void
  isPhone: boolean
  pageId: string | number
  // The RHF field's stable id (survives reorder) — used as sessionStorage key.
  blockFieldId: string
}) {
  // Default open: always true on desktop, true only for first 3 blocks on phone.
  const defaultOpen = !isPhone || index <= 2

  // SSR-safe: start with defaultOpen, hydrate from sessionStorage in effect.
  const [open, setOpen] = useState(defaultOpen)
  const [saveAsPresetOpen, setSaveAsPresetOpen] = useState(false)
  const namePrefix = `blocks.${index}`

  // Read persisted open state from sessionStorage on mount.
  useEffect(() => {
    const key = getSessionKey(pageId, blockFieldId)
    const stored = sessionStorage.getItem(key)
    if (stored !== null) {
      setOpen(stored === "1")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally only on mount — blockFieldId/pageId are stable

  // Persist open state changes to sessionStorage.
  const setOpenPersist = (next: boolean) => {
    setOpen(next)
    try {
      const key = getSessionKey(pageId, blockFieldId)
      sessionStorage.setItem(key, next ? "1" : "0")
    } catch { /* storage quota exceeded: silent */ }
  }

  // Listen for "expand all / collapse all" broadcast from BlockEditor.
  useEffect(() => {
    const onSet = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail
      if (typeof detail?.open === "boolean") setOpenPersist(detail.open)
    }
    document.addEventListener("editor:set-blocks-open", onSet)
    return () => document.removeEventListener("editor:set-blocks-open", onSet)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, blockFieldId])

  const { control } = useFormContext()
  const values = useWatch({ control, name: `blocks.${index}` }) as Record<string, unknown> | undefined
  const typedConfig = blockBySlug[blockSlug] as BlockWithMeta | undefined
  const summaryText = typedConfig?.summary?.(values ?? {}) as string | undefined

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
      <div className="flex items-center justify-between p-2 sticky top-0 z-[5] bg-background rounded-t-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenPersist(!open)}
            className="text-muted-foreground h-11 w-11 md:h-7 md:w-7 flex items-center justify-center"
            aria-label={open ? "Collapse block" : "Expand block"}
          >
            {open ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
          </button>
          <button
            type="button"
            className="cursor-grab text-muted-foreground touch-none active:cursor-grabbing h-11 w-11 md:h-7 md:w-7 flex items-center justify-center"
            aria-label="Drag to reorder block"
            {...listeners}
          >
            <GripVertical className="h-4 w-4"/>
          </button>
          {typedConfig?.icon && (
            <typedConfig.icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          )}
          <span className="font-medium">
            {typeof typedConfig?.labels?.singular === "string"
              ? typedConfig.labels.singular
              : blockSlug}
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
            className="h-11 w-11 md:h-8 md:w-8"
          >
            <BookmarkPlus className="h-4 w-4"/>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onRemove}
            aria-label="Remove block"
            className="h-11 w-11 md:h-8 md:w-8"
          >
            <Trash2 className="h-4 w-4"/>
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t p-3 space-y-3">
          {(typedConfig?.fields ?? []).map((f, i) => (
            <FieldRenderer key={i} field={f as any} namePrefix={namePrefix} />
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

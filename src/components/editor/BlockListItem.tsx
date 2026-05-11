"use client"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronRight, GripVertical, BookmarkPlus, Trash2, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FieldRenderer } from "./FieldRenderer"
import { SaveAsPresetDialog } from "./SaveAsPresetDialog"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useBlockKeyboardNav } from "./useBlockKeyboardNav"
import { useWatch, useFormContext } from "react-hook-form"
import { blockBySlug } from "@/blocks/registry"
import type { BlockWithMeta } from "@/blocks/_summary"
import { tinyVibrate } from "@/lib/haptics"

// Must match TouchSensor activationConstraint in BlockEditor.tsx exactly.
const PRESS_DELAY_MS = 200
const PRESS_TOLERANCE_PX = 5

export function BlockListItem({
  id,
  index,
  total,
  blockSlug,
  blockConfig,
  tenantId,
  onRemove,
  onMove,
  open,
  onOpenChange,
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
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const [saveAsPresetOpen, setSaveAsPresetOpen] = useState(false)
  const namePrefix = `blocks.${index}`

  const { control } = useFormContext()
  const values = useWatch({ control, name: `blocks.${index}` }) as Record<string, unknown> | undefined
  const typedConfig = blockBySlug[blockSlug] as BlockWithMeta | undefined
  const summaryText = typedConfig?.summary?.(values ?? {}) as string | undefined

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const kbd = useBlockKeyboardNav({ index, total, move: onMove })

  // Pre-drag "pressed" state for touch — fires after PRESS_DELAY_MS hold
  // on the drag handle, matching the TouchSensor activationConstraint.
  const [isPressed, setIsPressed] = useState(false)
  const pressTimerRef = useRef<number | null>(null)
  const pressStartRef = useRef<{ x: number; y: number } | null>(null)

  const cancelPress = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    pressStartRef.current = null
    setIsPressed(false)
  }

  const onHandlePointerDown = (e: React.PointerEvent) => {
    // Only touch needs the long-press visual. Mouse uses distance:4 (no delay).
    if (e.pointerType !== "touch") return
    pressStartRef.current = { x: e.clientX, y: e.clientY }
    pressTimerRef.current = window.setTimeout(() => {
      setIsPressed(true)
      tinyVibrate(5)
    }, PRESS_DELAY_MS)
  }

  const onHandlePointerMove = (e: React.PointerEvent) => {
    const start = pressStartRef.current
    if (!start) return
    if (
      Math.abs(e.clientX - start.x) > PRESS_TOLERANCE_PX ||
      Math.abs(e.clientY - start.y) > PRESS_TOLERANCE_PX
    ) {
      cancelPress()
    }
  }

  // Clear pressed state when actual drag begins (dnd-kit takes over the visual).
  useEffect(() => {
    if (isDragging) setIsPressed(false)
  }, [isDragging])

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current)
    }
  }, [])

  // Extract onPointerDown from dnd-kit listeners so we can chain our handler
  // first (start our timer) and then hand off to dnd-kit's tracker.
  const { onPointerDown: dndPointerDown, ...restListeners } = listeners ?? {}
  const combinedPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    onHandlePointerDown(e)
    dndPointerDown?.(e)
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined
  }

  return (
    // WCAG 4.1.2 — outer container is a non-interactive <div>. dnd-kit's
    // `attributes` (which include role="button" + aria-roledescription="sortable"
    // + aria-describedby for kbd-drag descriptions) move down to the explicit
    // drag-handle button per dnd-kit's drag-handle pattern. ArrowUp/Down kbd
    // reorder still fires from `onKeyDown` here because keydown bubbles up
    // from any focused inner element (drag handle, collapse, actions) and the
    // hook ignores keys originating in INPUT/TEXTAREA/SELECT/contenteditable.
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md ring-2 ring-muted-foreground/50 overflow-hidden bg-card transition-all duration-150",
        "data-[dragging]:ring-2 data-[dragging]:ring-primary data-[dragging]:shadow-lg data-[dragging]:bg-card/60",
        "data-[pressed]:ring-2 data-[pressed]:ring-primary/50 data-[pressed]:scale-[0.99]",
      )}
      data-dragging={isDragging || undefined}
      data-pressed={isPressed || undefined}
      onKeyDown={kbd.onKeyDown}
      aria-label={`Block ${index + 1}: ${typeof typedConfig?.labels?.singular === "string" ? typedConfig.labels.singular : blockSlug}`}
    >
      {/* Header layout: drag handle + icon + name on the LEFT; collapse
          chevron + Actions menu on the RIGHT. Per GitHub issue #14, the
          chevron belongs adjacent to the Actions menu, not in the leftmost
          cluster — visually groups "controls" together and gives the name
          its own breathing room. */}
      {/* UX-2026-0027 — header strip tightened on mobile (px-2, py-2) so the
          right-cluster (chevron + Actions) sits flush against the card edge,
          mirroring the left-cluster's tightness. */}
      <div className="flex items-center justify-between p-2 md:p-2 max-md:px-2 max-md:py-2 md:sticky md:top-0 md:z-[5] select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            className="cursor-grab text-muted-foreground touch-none active:cursor-grabbing h-11 w-11 md:h-7 md:w-7 flex items-center justify-center shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            aria-label="Drag to reorder block"
            {...attributes}
            {...restListeners}
            onPointerDown={combinedPointerDown}
            onPointerUp={cancelPress}
            onPointerCancel={cancelPress}
            onPointerMove={onHandlePointerMove}
          >
            <GripVertical className="h-4 w-4"/>
          </button>
          {typedConfig?.icon && (
            <typedConfig.icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          )}
          <span className={cn(
            "font-medium truncate",
            summaryText && "max-md:hidden",
          )}>
            {typeof typedConfig?.labels?.singular === "string" ? typedConfig.labels.singular : blockSlug}
          </span>
          {summaryText && (
            <span className="text-xs text-muted-foreground truncate min-w-0">
              · {summaryText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0 shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(!open)}
            className="text-muted-foreground h-11 w-11 md:h-7 md:w-7 flex items-center justify-center shrink-0"
            aria-label={open ? "Collapse block" : "Expand block"}
          >
            {open ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="max-md:size-11 size-8 shrink-0"
                aria-label="Block actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setSaveAsPresetOpen(true)}>
                <BookmarkPlus className="h-4 w-4 mr-2" />
                Save as preset
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onRemove}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {open && (
        <div className="p-3 space-y-3">
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

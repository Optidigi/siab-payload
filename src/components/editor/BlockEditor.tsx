"use client"
import { Fragment, useCallback, useEffect, useId, useMemo, useState } from "react"
import { useFormContext, useFieldArray } from "react-hook-form"
import { toast } from "sonner"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from "@dnd-kit/sortable"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LayoutTemplate, Plus } from "lucide-react"
import { blockBySlug } from "@/blocks/registry"
import { tinyVibrate } from "@/lib/haptics"
import { BlockListItem } from "./BlockListItem"
import { BlockTypePicker } from "./BlockTypePicker"
import { InsertSlot } from "./InsertSlot"

function getSessionKey(pageId: string | number, blockFieldId: string) {
  return `block-open:${pageId}:${blockFieldId}`
}

// `tenantId` is threaded all the way down to SaveAsPresetDialog (POST body)
// and BlockTypePicker (list-fetch filter). The multi-tenant plugin requires
// tenant on creates and only auto-scopes reads/writes for non-super-admin
// users — passing it explicitly works for both roles, so we always do.
export function BlockEditor({
  tenantId,
  isPhone,
  pageId,
}: {
  tenantId: number | string
  isPhone: boolean
  pageId: string | number
}) {
  const { control, getValues } = useFormContext()
  const { fields, append, insert, remove, move } = useFieldArray({ control, name: "blocks" })

  const handleRemove = (index: number) => {
    // Deep clone to avoid stale ref to nested asset IDs.
    const removed = JSON.parse(JSON.stringify(getValues(`blocks.${index}`)))
    remove(index)
    toast.success("Block deleted", {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () => insert(index, removed),
      },
    })
  }

  // Track which slot the picker should target. Open state lives here so
  // the InsertSlot buttons (and the trailing "+ Add block") can all share
  // one dialog instance without duplicating it in every slot.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerIndex, setPickerIndex] = useState<number>(0)
  const openPickerAt = (idx: number) => {
    setPickerIndex(idx)
    setPickerOpen(true)
  }

  // Per-block open state lives here (single source of truth — see FE-11).
  // sessionStorage hydration runs in the useEffect below; `setBlockOpen`
  // and `setAllOpen` both write through to storage so refresh persists.
  type OpenMap = Record<string, boolean>
  const [openMap, setOpenMap] = useState<OpenMap>({})

  // Hydrate from sessionStorage when fields change identity (mount, add, delete).
  useEffect(() => {
    setOpenMap(() => {
      const next: OpenMap = {}
      for (const [i, f] of fields.entries()) {
        const stored = sessionStorage.getItem(getSessionKey(pageId, f.id))
        if (stored !== null) next[f.id] = stored === "1"
        else next[f.id] = !isPhone && i === 0
      }
      return next
    })
  }, [pageId, isPhone, fields.length])

  const setBlockOpen = useCallback((blockFieldId: string, open: boolean) => {
    setOpenMap(prev => ({ ...prev, [blockFieldId]: open }))
    try {
      sessionStorage.setItem(getSessionKey(pageId, blockFieldId), open ? "1" : "0")
    } catch { /* storage quota: silent */ }
  }, [pageId])

  const setAllOpen = useCallback((open: boolean) => {
    setOpenMap(prev => {
      const next = { ...prev }
      for (const f of fields) {
        next[f.id] = open
        try {
          sessionStorage.setItem(getSessionKey(pageId, f.id), open ? "1" : "0")
        } catch { /* storage quota: silent */ }
      }
      return next
    })
  }, [fields, pageId])

  const allOpen = useMemo(
    () => fields.length > 0 && fields.every(f => openMap[f.id] === true),
    [fields, openMap],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 }, // desktop mouse-friendly
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 }, // long-press for touch
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = fields.findIndex((f) => f.id === active.id)
    const to = fields.findIndex((f) => f.id === over.id)
    if (from === -1 || to === -1) return
    // Mirror dnd-kit's reorder onto RHF's field array. Using move() (not
    // replace via arrayMove → setValue) keeps RHF's internal field IDs
    // stable, which is what SortableContext keys off.
    move(from, to)
  }

  // `seed` is optional pre-filled field values from a saved preset. The
  // slug always wins — preset.blockType is never trusted to override the
  // tile the user picked. RHF's `useFieldArray` will assign its own
  // synthetic `.id` to the new row regardless of what we pass.
  const onAdd = (slug: string, atIndex: number, seed?: Record<string, unknown>) => {
    const row = { blockType: slug, ...(seed ?? {}) }
    // Capture the BEFORE-insert length to know the new block's index.
    const newIndex = atIndex >= fields.length ? fields.length : atIndex
    if (atIndex >= fields.length) {
      append(row)
    } else {
      insert(atIndex, row)
    }
    requestAnimationFrame(() => {
      const el = document.querySelector(`[name^="blocks.${newIndex}."]`) as HTMLElement | null
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        el.focus({ preventScroll: true })
      }
    })
  }

  // FN-2026-0066b — pass a stable `id` to DndContext. dnd-kit's
  // accessibility describer IDs (`DndDescribedBy-N`) auto-increment from
  // a module-level counter, which diverges between SSR and the client
  // hydration pass — yielding `aria-describedby="DndDescribedBy-3"` on
  // server vs `aria-describedby="DndDescribedBy-0"` on client. Passing
  // an explicit id prefixes those announcement IDs deterministically.
  // Using React.useId so the prefix is unique per BlockEditor instance
  // (matters for any future page that mounts multiple editors).
  const dndId = useId()
  return (
    <div className="space-y-3">
      {fields.length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" type="button" onClick={() => setAllOpen(!allOpen)}>
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        </div>
      )}
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} onDragStart={() => tinyVibrate(10)}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 max-md:px-2 text-center border border-dashed rounded-lg">
              <LayoutTemplate className="h-10 w-10 text-muted-foreground" aria-hidden />
              <div className="space-y-1">
                <p className="text-base font-medium">No blocks yet</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Add your first block to start building this page.
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                onClick={() => openPickerAt(0)}
                className="w-full md:w-auto max-w-xs"
              >
                <Plus className="h-5 w-5" /> Add first block
              </Button>
            </div>
          ) : (
            <div className="space-y-1 max-md:space-y-3.5">
              {fields.map((f, i) => {
                const slug = (f as any).blockType
                const cfg = blockBySlug[slug]
                if (!cfg) return null
                return (
                  <Fragment key={f.id}>
                    <InsertSlot onClick={() => openPickerAt(i)} />
                    <BlockListItem
                      id={f.id}
                      index={i}
                      total={fields.length}
                      blockSlug={slug}
                      blockConfig={cfg}
                      tenantId={tenantId}
                      onRemove={() => handleRemove(i)}
                      onMove={(from, to) => move(from, to)}
                      open={openMap[f.id] ?? false}
                      onOpenChange={(next) => setBlockOpen(f.id, next)}
                    />
                  </Fragment>
                )
              })}
              <InsertSlot onClick={() => openPickerAt(fields.length)} />
            </div>
          )}
        </SortableContext>
      </DndContext>
      <BlockTypePicker
        onAdd={onAdd}
        defaultIndex={pickerIndex}
        controlledOpen={pickerOpen}
        onOpenChange={setPickerOpen}
        tenantId={tenantId}
      />
      {/*
        Trailing "+ Add block" — desktop-with-blocks only. Hidden on:
        - empty pages (the centred empty-state CTA covers entry)
        - phone with blocks (the floating FAB in PageForm covers it)
        so this Button only appears on md+ when fields.length > 0.
      */}
      <Button
        type="button"
        variant="default"
        size="lg"
        onClick={() => openPickerAt(fields.length)}
        aria-label="Add block at end"
        className={cn(
          "w-full",
          fields.length > 0 && "hidden md:flex",
          fields.length === 0 && "hidden",
        )}
      >
        <Plus className="h-5 w-5" /> Add block
      </Button>
    </div>
  )
}

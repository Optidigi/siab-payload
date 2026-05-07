"use client"
import { Fragment, useEffect, useState } from "react"
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

  // Expand all / collapse all toggle. Broadcasts via CustomEvent so all
  // mounted BlockListItems can respond without prop-drilling.
  const [allCollapsed, setAllCollapsed] = useState(false)
  const onToggleAll = () => {
    const nextCollapsed = !allCollapsed
    setAllCollapsed(nextCollapsed)
    document.dispatchEvent(
      new CustomEvent("editor:set-blocks-open", { detail: { open: !nextCollapsed } })
    )
  }

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

  return (
    <div className="space-y-3">
      {fields.length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" type="button" onClick={onToggleAll}>
            {allCollapsed ? "Expand all" : "Collapse all"}
          </Button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} onDragStart={() => tinyVibrate(10)}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center border border-dashed rounded-lg">
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
            <div className="space-y-1 max-md:space-y-2.5">
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
                      isPhone={isPhone}
                      pageId={pageId}
                      blockFieldId={f.id}
                    />
                  </Fragment>
                )
              })}
              <InsertSlot onClick={() => openPickerAt(fields.length)} />
            </div>
          )}
        </SortableContext>
      </DndContext>
      {/*
        Trailing "+ Add block" stays as a redundant action so an empty page
        always has an obvious entry point (no hover target until at least
        one block exists). InsertSlots cover the "add between" path.
      */}
      <BlockTypePicker
        onAdd={onAdd}
        defaultIndex={pickerIndex}
        controlledOpen={pickerOpen}
        onOpenChange={setPickerOpen}
        tenantId={tenantId}
      />
      {/*
        Trailing "+ Add block" — desktop and `<md` empty-state only. Phone
        with blocks present uses the floating FAB (PageForm renders it),
        so this would be a duplicate affordance. Render only when:
        - on desktop (md+), OR
        - on phone with zero blocks (so the empty state has a clear CTA
          before the FAB has anything to add to). When fields.length > 0,
          phone hides this in favor of the FAB.
      */}
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent",
          fields.length > 0 && "hidden md:inline-flex",
          fields.length === 0 && "hidden",
        )}
        onClick={() => openPickerAt(fields.length)}
        aria-label="Add block at end"
      >
        + Add block
      </button>
    </div>
  )
}

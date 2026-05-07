"use client"
import { Fragment, useState } from "react"
import { useFormContext, useFieldArray } from "react-hook-form"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
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
import { blockBySlug } from "@/blocks/registry"
import { BlockListItem } from "./BlockListItem"
import { BlockTypePicker } from "./BlockTypePicker"
import { InsertSlot } from "./InsertSlot"

// `tenantId` is threaded all the way down to SaveAsPresetDialog (POST body)
// and BlockTypePicker (list-fetch filter). The multi-tenant plugin requires
// tenant on creates and only auto-scopes reads/writes for non-super-admin
// users — passing it explicitly works for both roles, so we always do.
export function BlockEditor({ tenantId }: { tenantId: number | string }) {
  const { control } = useFormContext()
  const { fields, append, insert, remove, move } = useFieldArray({ control, name: "blocks" })

  // Track which slot the picker should target. Open state lives here so
  // the InsertSlot buttons (and the trailing "+ Add block") can all share
  // one dialog instance without duplicating it in every slot.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerIndex, setPickerIndex] = useState<number>(0)
  const openPickerAt = (idx: number) => {
    setPickerIndex(idx)
    setPickerOpen(true)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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
    if (atIndex >= fields.length) {
      append(row)
    } else {
      insert(atIndex, row)
    }
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
              <div className="text-2xl">📄</div>
              <div className="space-y-1">
                <p className="text-base font-medium">No blocks yet</p>
                <p className="text-sm text-muted-foreground">
                  Add your first block to start building this page.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
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
                      onRemove={() => remove(i)}
                      onMove={(from, to) => move(from, to)}
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
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        onClick={() => openPickerAt(fields.length)}
        aria-label="Add block at end"
      >
        + Add block
      </button>
    </div>
  )
}

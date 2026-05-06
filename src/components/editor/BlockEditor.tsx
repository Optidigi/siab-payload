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
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from "@dnd-kit/sortable"
import { blockBySlug } from "@/blocks/registry"
import { BlockListItem } from "./BlockListItem"
import { BlockTypePicker } from "./BlockTypePicker"
import { InsertSlot } from "./InsertSlot"

export function BlockEditor() {
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
    const next = arrayMove(fields, from, to)
    // Mirror the dnd-kit reorder onto RHF's field array via move(). Using
    // move (not replace) keeps RHF's internal field IDs stable, which is
    // important for the SortableContext key continuity.
    void next
    move(from, to)
  }

  const onAdd = (slug: string, atIndex: number) => {
    if (atIndex >= fields.length) {
      append({ blockType: slug })
    } else {
      insert(atIndex, { blockType: slug })
    }
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
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
                    onRemove={() => remove(i)}
                    onMove={(from, to) => move(from, to)}
                  />
                </Fragment>
              )
            })}
            {fields.length > 0 && <InsertSlot onClick={() => openPickerAt(fields.length)} />}
          </div>
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

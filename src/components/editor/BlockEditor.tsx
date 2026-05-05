"use client"
import { useFormContext, useFieldArray } from "react-hook-form"
import { blockBySlug } from "@/blocks/registry"
import { BlockListItem } from "./BlockListItem"
import { BlockTypePicker } from "./BlockTypePicker"

export function BlockEditor() {
  const { control } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name: "blocks" })

  return (
    <div className="space-y-3">
      {fields.map((f, i) => {
        const slug = (f as any).blockType
        const cfg = blockBySlug[slug]
        if (!cfg) return null
        return <BlockListItem key={f.id} index={i} blockSlug={slug} blockConfig={cfg} onRemove={() => remove(i)} />
      })}
      <BlockTypePicker onAdd={(slug) => append({ blockType: slug })} />
    </div>
  )
}

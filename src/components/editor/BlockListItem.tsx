"use client"
import { useState } from "react"
import { ChevronDown, ChevronRight, Trash2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldRenderer } from "./FieldRenderer"

export function BlockListItem({
  index, blockSlug, blockConfig, onRemove
}: { index: number; blockSlug: string; blockConfig: any; onRemove: () => void }) {
  const [open, setOpen] = useState(true)
  const namePrefix = `blocks.${index}`

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen(!open)} className="text-muted-foreground">
            {open ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
          </button>
          <GripVertical className="h-4 w-4 text-muted-foreground"/>
          <span className="font-medium">{blockSlug}</span>
        </div>
        <Button variant="ghost" size="icon" type="button" onClick={onRemove}>
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

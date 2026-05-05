"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { BLOCKS } from "@/blocks/registry"

export function BlockTypePicker({ onAdd }: { onAdd: (slug: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" type="button"><Plus className="mr-1 h-4 w-4"/> Add block</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a block</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {BLOCKS.map((b) => (
            <button
              key={b.slug}
              type="button"
              className="rounded-md border p-3 text-left hover:bg-accent"
              onClick={() => { onAdd(b.slug); setOpen(false) }}
            >
              <div className="font-medium">{b.slug}</div>
              <div className="text-xs text-muted-foreground">{b.fields.length} fields</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TypedConfirmDialog } from "@/components/shared/TypedConfirmDialog"
import { Plus, ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { BLOCKS } from "@/blocks/registry"
import { sanitizePresetData } from "@/lib/blockPresets/sanitize"
import { parsePayloadError } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { BlockPreset } from "@/payload-types"

/**
 * Block-type picker dialog with expandable tiles for inserting from a saved
 * block preset.
 *
 * Two ways to use it:
 *
 *  - Default trigger (legacy "+ Add block" button): omit `controlledOpen`
 *    and `onOpenChange`. The picker renders its own outline button.
 *  - Programmatic (from an InsertSlot): pass `controlledOpen` and
 *    `onOpenChange`. No trigger button is rendered.
 *
 * `onAdd(slug, atIndex, seed?)` lets the caller insert at an arbitrary
 * index, and optionally pass a seed object with pre-filled field values
 * (this is how preset-insert works — the seed comes from the preset's
 * `data` blob, run through `sanitizePresetData` to drop any fields that
 * no longer exist in the live block config).
 *
 * Preset list is fetched once when the dialog opens (small payload, short-
 * lived modal — no need for SWR / re-fetch / cache). Adding/deleting a
 * preset triggers a manual reload so the local state stays in sync.
 */
export function BlockTypePicker({
  onAdd,
  defaultIndex,
  controlledOpen,
  onOpenChange,
  tenantId
}: {
  // `seed` is optional; when present, the new block is inserted with these
  // field values merged under `{ blockType: slug, ... }`. The slug always
  // wins — preset.blockType is never trusted to override.
  onAdd: (slug: string, atIndex: number, seed?: Record<string, unknown>) => void
  defaultIndex?: number
  controlledOpen?: boolean
  onOpenChange?: (open: boolean) => void
  // Scope the preset list to this tenant. The plugin auto-scopes for
  // editors/owners, but super-admins see all tenants by default — passing
  // tenantId in the where clause is the explicit, role-agnostic answer.
  tenantId: number | string
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (o: boolean) => {
    if (isControlled) onOpenChange?.(o)
    else setInternalOpen(o)
  }

  // Per-tile expansion: which slug's preset list is currently visible.
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)

  // Preset list, loaded on dialog open. Errors surface inline rather than
  // crashing the picker (you can still pick a blank block).
  const [presets, setPresets] = useState<BlockPreset[]>([])
  const [presetError, setPresetError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setPresetError(null)
    try {
      const url = `/api/block-presets?limit=200&depth=0&sort=-updatedAt&where[tenant][equals]=${encodeURIComponent(String(tenantId))}`
      const res = await fetch(url)
      if (!res.ok) {
        const detail = await parsePayloadError(res)
        throw new Error(detail.message)
      }
      const json = await res.json()
      setPresets((json.docs as BlockPreset[]) ?? [])
    } catch (e) {
      setPresetError(e instanceof Error ? e.message : String(e))
    }
  }, [tenantId])

  useEffect(() => {
    if (open) {
      setExpandedSlug(null)
      reload()
    }
  }, [open, reload])

  const presetsBySlug = useMemo(() => {
    const out: Record<string, BlockPreset[]> = {}
    for (const p of presets) {
      const slug = p.blockType
      if (!out[slug]) out[slug] = []
      out[slug].push(p)
    }
    return out
  }, [presets])

  const insertAt = defaultIndex ?? Number.MAX_SAFE_INTEGER

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" type="button">
            <Plus className="mr-1 h-4 w-4" /> Add block
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Add a block</DialogTitle></DialogHeader>
        {presetError && (
          <p className="text-xs text-destructive">
            Couldn&apos;t load saved presets: {presetError}. You can still pick a blank block.
          </p>
        )}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {BLOCKS.map((b) => {
            const tilePresets = presetsBySlug[b.slug] ?? []
            const isExpanded = expandedSlug === b.slug
            const hasPresets = tilePresets.length > 0

            return (
              <div key={b.slug} className="rounded-md border">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 p-3 text-left",
                    "hover:bg-accent",
                    isExpanded && "bg-accent/50"
                  )}
                  onClick={() => {
                    if (hasPresets) {
                      setExpandedSlug(isExpanded ? null : b.slug)
                    } else {
                      onAdd(b.slug, insertAt)
                      setOpen(false)
                    }
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {b.icon && (
                      <b.icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">
                        {typeof b.labels?.singular === "string" ? b.labels.singular : b.slug}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {b.description ?? `${b.fields.length} fields`}
                        {hasPresets && ` · ${tilePresets.length} preset${tilePresets.length === 1 ? "" : "s"}`}
                      </div>
                    </div>
                  </div>
                  {hasPresets && (
                    <span className="text-muted-foreground" aria-hidden>
                      {isExpanded ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
                    </span>
                  )}
                </button>
                {isExpanded && hasPresets && (
                  <div className="border-t">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        onAdd(b.slug, insertAt)
                        setOpen(false)
                      }}
                    >
                      <span className="text-muted-foreground">+</span>
                      <span>Blank {b.slug}</span>
                    </button>
                    {tilePresets.map((preset) => (
                      <PresetRow
                        key={preset.id}
                        preset={preset}
                        onInsert={() => {
                          const seed = sanitizePresetData(b.slug, preset.data)
                          onAdd(b.slug, insertAt, seed)
                          setOpen(false)
                        }}
                        onDeleted={reload}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * One row inside an expanded tile. Click the row body to insert; the trash
 * icon opens a TypedConfirmDialog requiring the preset name.
 *
 * Confirm copy reminds the operator that deleting a preset doesn't touch
 * already-inserted blocks — they're independent copies, that's the model.
 */
function PresetRow({
  preset,
  onInsert,
  onDeleted
}: {
  preset: BlockPreset
  onInsert: () => void
  onDeleted: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="flex items-center gap-2 border-t px-3 py-2 text-sm hover:bg-accent">
      <button type="button" className="flex-1 min-w-0 text-left" onClick={onInsert}>
        <div className="font-medium truncate">{preset.name}</div>
        {preset.description && (
          <div className="text-xs text-muted-foreground truncate">{preset.description}</div>
        )}
      </button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setConfirmOpen(true)
        }}
        aria-label={`Delete preset ${preset.name}`}
        className="h-7 w-7"
      >
        <Trash2 className="h-3.5 w-3.5"/>
      </Button>
      <TypedConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete preset "${preset.name}"`}
        description={
          <>
            This removes the preset from the picker. <strong>It won&apos;t affect blocks already inserted on pages.</strong>
          </>
        }
        confirmPhrase={preset.name}
        confirmLabel="Delete preset"
        onConfirm={async () => {
          const res = await fetch(`/api/block-presets/${preset.id}`, { method: "DELETE" })
          if (!res.ok) {
            const detail = await parsePayloadError(res)
            throw new Error(detail.message)
          }
          toast.success(`Deleted preset "${preset.name}"`)
          onDeleted()
        }}
      />
    </div>
  )
}

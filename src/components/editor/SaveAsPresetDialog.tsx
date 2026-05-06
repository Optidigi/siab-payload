"use client"
import { useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { parsePayloadError } from "@/lib/api"
import { blockBySlug } from "@/blocks/registry"

/**
 * Save-as-preset dialog.
 *
 * Reads the current RHF values for `blocks.${blockIndex}` (the live values
 * the user has on screen for this block), strips RHF's synthetic `.id`,
 * and POSTs to the `block-presets` REST endpoint. The form's dirty state
 * is unaffected — saving a preset is independent of saving the page.
 *
 * No required-field gating: presets are templates, partial defaults are
 * legitimate ("our standard CTA scaffold, fill in the copy"). We do show
 * a passive note when the live block has empty required fields, so the
 * operator knows the preset will need them filled in on insert.
 *
 * On success: invokes `onSaved()` so the parent picker can refetch its
 * preset list.
 */
export function SaveAsPresetDialog({
  open,
  onOpenChange,
  blockIndex,
  blockSlug,
  onSaved
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  blockIndex: number
  blockSlug: string
  onSaved?: () => void
}) {
  const { getValues } = useFormContext()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName("")
      setDescription("")
      setError(null)
      setPending(false)
    }
  }, [open])

  // Live values for this block, including the synthetic `.id` RHF assigns
  // each useFieldArray row. Strip both `.id` and `.blockType` from the
  // payload — server-side `blockType` is set from the form field, and
  // RHF's `.id` is a client-side render key with no DB meaning.
  const liveBlock = (getValues(`blocks.${blockIndex}`) ?? {}) as Record<string, unknown>
  const { id: _omitId, blockType: _omitBlockType, ...data } = liveBlock

  // Passive missing-required check (purely informational — we don't gate).
  const cfg = blockBySlug[blockSlug]
  const missingRequired: string[] = []
  if (cfg) {
    for (const f of cfg.fields) {
      if ("required" in f && f.required && "name" in f && f.name) {
        const v = (data as Record<string, unknown>)[f.name]
        if (v == null || v === "") missingRequired.push(f.name)
      }
    }
  }

  const canSubmit = name.trim().length > 0 && !pending

  const submit = async () => {
    if (!canSubmit) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/block-presets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          blockType: blockSlug,
          data
        })
      })
      if (!res.ok) {
        const detail = await parsePayloadError(res)
        throw new Error(detail.message)
      }
      toast.success(`Saved preset "${name.trim()}"`)
      onSaved?.()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (pending ? null : onOpenChange(o))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save block as preset</DialogTitle>
          <DialogDescription>
            Capture this <strong>{blockSlug}</strong> block&apos;s current values so you can insert it pre-filled on another page in this tenant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="preset-name" className="text-sm font-normal">Name</Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Homepage hero — spring 2026"
              disabled={pending}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preset-description" className="text-sm font-normal">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="preset-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="When should someone use this preset?"
              disabled={pending}
            />
          </div>
          {missingRequired.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Note: {missingRequired.length === 1 ? "this field is" : "these fields are"} empty —{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                {missingRequired.join(", ")}
              </code>
              . Saving anyway is fine; whoever inserts this preset will need to fill them in.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {pending ? "Saving..." : "Save preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

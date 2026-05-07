"use client"
import { useEffect, useState, useCallback } from "react"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { MediaGrid } from "./MediaGrid"
import { MediaUploader } from "./MediaUploader"
import type { Media } from "@/payload-types"

type Props = { value?: any; onChange: (v: any) => void; relationTo?: string; tenantId?: number | string }

export function MediaPicker({ value, onChange, tenantId }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Media[]>([])
  const [resolvedTenantId, setResolvedTenantId] = useState<number | string | null>(tenantId ?? null)

  // Resolve tenant id if not passed in (most callers won't pass it).
  // Strategy:
  //   1. /api/users/me -> if user.role === "super-admin", parse /sites/<slug> from URL
  //   2. otherwise tenant id is on the user record (user.tenants[0].tenant)
  useEffect(() => {
    if (resolvedTenantId != null) return
    let cancelled = false
    ;(async () => {
      const meRes = await fetch("/api/users/me")
      if (!meRes.ok) return
      const me = (await meRes.json()).user
      if (!me) return
      if (me.role === "super-admin") {
        const m = window.location.pathname.match(/\/sites\/([^/]+)/)
        if (!m || !m[1]) return
        const tRes = await fetch(`/api/tenants?where[slug][equals]=${encodeURIComponent(m[1])}&limit=1`)
        if (!tRes.ok) return
        const tJson = await tRes.json()
        const tid = tJson.docs?.[0]?.id
        if (tid != null && !cancelled) setResolvedTenantId(tid)
      } else {
        const first = me.tenants?.[0]?.tenant
        const tid = typeof first === "object" && first ? first.id : first
        if (tid != null && !cancelled) setResolvedTenantId(tid)
      }
    })()
    return () => { cancelled = true }
  }, [resolvedTenantId])

  const reload = useCallback(async () => {
    if (resolvedTenantId == null) return
    const res = await fetch(`/api/media?where[tenant][equals]=${resolvedTenantId}&limit=200&sort=-updatedAt`)
    if (!res.ok) return
    const json = await res.json()
    setItems(json.docs ?? [])
  }, [resolvedTenantId])

  useEffect(() => { if (open) reload() }, [open, reload])

  // Boundary normalization: if a parent passes us a populated Media object
  // (e.g. from a depth>=1 fetch), reduce it to its id so the form holds a
  // primitive. Prevents Payload upstream bug on next submit (see
  // PageForm.normalizeUploadId for the matching belt).
  //
  // Loop safety: RHF's `field.onChange` from <Controller> is NOT guaranteed
  // stable across renders, but the typeof-object guard is what stops the
  // effect from re-firing — once we've called onChange(value.id), `value`
  // becomes a primitive and the if-condition is false on the next render.
  // Do NOT remove that guard; identity churn on `onChange` alone would
  // otherwise loop forever.
  useEffect(() => {
    if (value && typeof value === "object" && "id" in value) {
      const id = (value as { id: unknown }).id
      if (typeof id === "number" || typeof id === "string") onChange(id)
    }
  }, [value, onChange])

  // The form stores either a Media id (number) OR a populated Media object.
  // Resolve to a display object if we can find it.
  const valueId = typeof value === "object" && value ? (value as any).id : value
  const current = items.find((m) => (m.id as any) === valueId) ?? (typeof value === "object" ? (value as Media) : null)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-md border p-3">
        {current?.url
          ? <img src={current.url} alt={current.alt ?? ""} className="h-10 w-10 object-cover rounded" />
          : <div className="h-10 w-10 rounded bg-muted" />}
        <div className="text-sm flex-1 min-w-0 truncate">
          {current
            ? <><div className="font-medium truncate">{current.filename}</div><div className="text-xs text-muted-foreground truncate">{current.alt ?? ""}</div></>
            : "No selection"}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" type="button">Choose</Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            // Phone: full width so the sheet doesn't overflow viewport
            // (375px screens were getting clipped at 640px). Desktop:
            // 640px panel as before.
            className="w-full sm:w-[640px] sm:max-w-[640px] overflow-y-auto"
            showCloseButton={false}
          >
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between gap-2">
                <span>Choose media</span>
                <div className="flex items-center gap-1.5">
                  {resolvedTenantId != null && <MediaUploader tenantId={resolvedTenantId} onUploaded={() => reload()} />}
                  {/*
                    Close button positioned next to the uploader rather than
                    the absolute top-right (the default Sheet close X used to
                    sit there and overlap the uploader). Grouped here so both
                    affordances live in the title row.
                  */}
                  <SheetClose asChild>
                    <Button variant="ghost" size="icon" type="button" aria-label="Close" className="h-8 w-8">
                      <X className="h-4 w-4" />
                    </Button>
                  </SheetClose>
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <MediaGrid items={items} selectable onSelect={(m) => { onChange(m.id); setOpen(false) }} />
            </div>
          </SheetContent>
        </Sheet>
        {value != null && (
          <Button variant="ghost" size="sm" type="button" onClick={() => onChange(null)}>Clear</Button>
        )}
      </div>
    </div>
  )
}

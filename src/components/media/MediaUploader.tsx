"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Upload } from "lucide-react"
import { parsePayloadError } from "@/lib/api"

export function MediaUploader({ tenantId, onUploaded }: { tenantId: number | string; onUploaded?: (m: any) => void }) {
  const [pending, setPending] = useState(false)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // FN-2026-0038 — `disabled={pending}` on the visible Button forwards
    // through Radix Slot to a <span>, where `disabled` is a no-op. The
    // hidden <input> stayed pickable, so a fast re-pick during an in-
    // flight upload fired a second concurrent POST /api/media. Early-
    // return on pending here is the load-bearing guard; the input also
    // gets `disabled={pending}` below as defense-in-depth (browsers
    // honour the prop on the <input> directly even when triggered via a
    // wrapping <label>).
    if (pending) {
      e.target.value = ""
      return
    }
    setPending(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("_payload", JSON.stringify({ alt: file.name, tenant: tenantId }))
      const res = await fetch("/api/media", { method: "POST", body: fd })
      if (!res.ok) {
        // Surface server-side validation/storage error with detail so a
        // silent failure can't masquerade as success. Previously this was
        // a bare "Upload failed" toast with no actionable info.
        const { message } = await parsePayloadError(res)
        toast.error(message || `Upload failed (${res.status})`)
        return
      }
      const json = await res.json()
      toast.success(`Uploaded ${file.name}`)
      onUploaded?.(json.doc ?? json)
    } catch (err) {
      // Network failure / aborted request / FormData encoding error — same
      // category as a non-OK response from the operator's perspective.
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setPending(false)
      e.target.value = "" // allow re-picking the same file
    }
  }

  return (
    <label>
      <input
        type="file"
        hidden
        onChange={onPick}
        accept="image/*,video/mp4,application/pdf"
        disabled={pending}
      />
      <Button asChild variant="outline" disabled={pending}>
        <span><Upload className="mr-1 h-4 w-4" />{pending ? "Uploading..." : "Upload"}</span>
      </Button>
    </label>
  )
}

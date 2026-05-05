"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Upload } from "lucide-react"

export function MediaUploader({ tenantId, onUploaded }: { tenantId: number | string; onUploaded?: (m: any) => void }) {
  const [pending, setPending] = useState(false)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPending(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("_payload", JSON.stringify({ alt: file.name, tenant: tenantId }))
    const res = await fetch("/api/media", { method: "POST", body: fd })
    setPending(false)
    e.target.value = "" // allow re-picking the same file
    if (!res.ok) { toast.error("Upload failed"); return }
    const json = await res.json()
    toast.success("Uploaded")
    onUploaded?.(json.doc ?? json)
  }

  return (
    <label>
      <input type="file" hidden onChange={onPick} accept="image/*,video/mp4,application/pdf" />
      <Button asChild variant="outline" disabled={pending}>
        <span><Upload className="mr-1 h-4 w-4" />{pending ? "Uploading..." : "Upload"}</span>
      </Button>
    </label>
  )
}

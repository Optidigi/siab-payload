"use client"
export function MediaPicker({ value }: { value?: any; onChange: (v: any) => void; relationTo?: string }) {
  return (
    <div className="rounded-md border p-3 text-xs text-muted-foreground">
      Media picker (Phase 10) · current: <code>{typeof value === "string" || typeof value === "number" ? String(value) : value?.id ?? "—"}</code>
    </div>
  )
}

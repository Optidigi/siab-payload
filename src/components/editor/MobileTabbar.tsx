"use client"
import { Pencil, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Phone-only bottom tabbar. Replaces the SaveStatusBar's `<md` branch
 * (suppressed in Step 6) and acts as the single anchor for save and
 * preview state on the phone breakpoint.
 *
 * Each tab carries a small status dot:
 *   - Edit dot   = save lifecycle  (saved | unsaved | saving | error)
 *   - Preview dot = preview lifecycle (live | loading | reconnecting | error | not-loaded)
 *
 * Tapping Edit collapses the preview sheet to closed. Tapping Preview
 * cycles the sheet through closed → peek → full → closed (parent owns
 * the cycle so the same tabbar stays a pure-presentational component).
 *
 * `onPointerDown(e => e.preventDefault())` on each button stops the
 * tab tap from yanking focus out of whatever input the operator was
 * typing into — important on iOS where a focus loss collapses the
 * software keyboard mid-tap.
 */
type SaveDotStatus = "saved" | "unsaved" | "saving" | "error"
type PreviewDotStatus = "live" | "loading" | "reconnecting" | "error" | "not-loaded"

type Props = {
  saveStatus: SaveDotStatus
  previewStatus: PreviewDotStatus
  sheetState: "closed" | "peek" | "full"
  onTapEdit: () => void
  onTapPreview: () => void
}

function dotClass(status: SaveDotStatus | PreviewDotStatus): string {
  if (status === "saved" || status === "not-loaded") return "bg-muted-foreground/40"
  if (status === "live") return "bg-green-500"
  if (status === "saving" || status === "loading" || status === "reconnecting") return "bg-amber-500 animate-pulse"
  if (status === "unsaved") return "bg-amber-500"
  return "bg-destructive"
}

export function MobileTabbar({ saveStatus, previewStatus, sheetState, onTapEdit, onTapPreview }: Props) {
  const editActive = sheetState === "closed"
  const previewActive = sheetState !== "closed"
  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 md:hidden",
        "flex items-stretch border-t bg-background",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
      )}
    >
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={onTapEdit}
        className={cn(
          "flex-1 flex flex-col items-center justify-center gap-0.5 py-2",
          editActive ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label="Switch to edit"
        aria-pressed={editActive}
      >
        <Pencil className="h-6 w-6" />
        <span className="text-[11px] font-medium flex items-center gap-1">
          Edit
          <span className={cn("h-2 w-2 rounded-full", dotClass(saveStatus))} aria-hidden />
        </span>
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={onTapPreview}
        className={cn(
          "flex-1 flex flex-col items-center justify-center gap-0.5 py-2",
          previewActive ? "text-foreground" : "text-muted-foreground",
        )}
        aria-label="Switch to preview"
        aria-pressed={previewActive}
      >
        <Eye className="h-6 w-6" />
        <span className="text-[11px] font-medium flex items-center gap-1">
          Preview
          <span className={cn("h-2 w-2 rounded-full", dotClass(previewStatus))} aria-hidden />
        </span>
      </button>
    </div>
  )
}

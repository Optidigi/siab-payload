"use client"
import { useFormContext } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { useRelativeTime } from "@/lib/useRelativeTime"
import { cn } from "@/lib/utils"

type Props = {
  pending: boolean
  isDirty: boolean
  errorCount: number
  saveStatus: "idle" | "saving" | "saved" | "dirty" | "error"
  lastSavedAt: number | null
  onSave: () => void
}

export function PhoneTopBanner({ pending, isDirty, errorCount, saveStatus, lastSavedAt, onSave }: Props) {
  const { watch } = useFormContext()
  const title = watch("title") as string | undefined
  const relTime = useRelativeTime(lastSavedAt)
  const showSave = isDirty || errorCount > 0
  const statusText =
    saveStatus === "saving" ? "Saving…" :
    saveStatus === "error" ? `Error (${errorCount})` :
    saveStatus === "dirty" ? `${errorCount > 0 ? `${errorCount} ` : ""}unsaved` :
    saveStatus === "saved" && relTime ? `Saved ${relTime}` :
    null

  return (
    <header
      className="md:hidden sticky top-0 z-30 flex items-center gap-2 h-12 px-2 border-b bg-background"
      // Avoid scroll-anchor jumps when status text width changes during save.
      style={{ contentVisibility: "auto" }}
    >
      <div className="flex-1 min-w-0 truncate text-sm font-medium">
        {title || "Untitled"}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {statusText && (
          <span className={cn(
            "text-xs",
            saveStatus === "error" && "text-destructive",
            saveStatus === "saving" && "text-muted-foreground",
            saveStatus === "dirty" && "text-amber-600 dark:text-amber-400",
            saveStatus === "saved" && "text-muted-foreground",
          )}>
            {statusText}
          </span>
        )}
        {showSave && (
          <Button
            size="sm"
            onClick={onSave}
            disabled={pending}
            onPointerDown={(e) => {
              const tag = document.activeElement?.tagName
              if (tag === "INPUT" || tag === "TEXTAREA") e.preventDefault()
            }}
            className="h-9 gap-1.5"
            title="Save (⌘S / Ctrl+S)"
          >
            {pending ? "Saving…" : "Save"}
            {errorCount > 0 && (
              <span className="rounded bg-destructive-foreground text-destructive text-xs px-1.5 py-0.5 leading-none">
                {errorCount}
              </span>
            )}
          </Button>
        )}
      </div>
    </header>
  )
}

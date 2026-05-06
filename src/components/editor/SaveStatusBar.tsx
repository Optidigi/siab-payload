"use client"
import { useEffect, useState } from "react"
import { Loader2, AlertCircle, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * SaveStatusBar — UI-only sticky bar that reflects the page-form's
 * save lifecycle. It does NOT trigger saves; the form's existing Save
 * button remains the source of action. The bar transitions:
 *
 *   clean (initial)   -> hidden
 *   dirty             -> "Unsaved changes" (yellow)
 *   submitting        -> "Saving..."       (neutral, spinner)
 *   submit succeeded  -> "All changes saved" briefly (4s) then hide
 *   submit failed     -> "Save failed — Retry" (red); Retry calls onRetry
 *
 * The bar is purely visual: navigation guarding lives in
 * `useNavigationGuard`, which the parent form is responsible for
 * mounting against its own dirty/pending state.
 */
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"

export function SaveStatusBar({
  status,
  onRetry
}: {
  status: SaveStatus
  onRetry?: () => void
}) {
  // Hide the "saved" tick after a delay so the bar doesn't linger.
  const [showSaved, setShowSaved] = useState(false)
  useEffect(() => {
    if (status === "saved") {
      setShowSaved(true)
      const t = setTimeout(() => setShowSaved(false), 4000)
      return () => clearTimeout(t)
    }
    setShowSaved(false)
  }, [status])

  // Don't render at all on first render before any change has happened.
  if (status === "idle") return null
  if (status === "saved" && !showSaved) return null

  let tone = "border-border bg-muted text-muted-foreground"
  let icon: React.ReactNode = null
  let label = ""

  if (status === "dirty") {
    tone = "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
    label = "Unsaved changes"
  } else if (status === "saving") {
    tone = "border-border bg-muted text-muted-foreground"
    icon = <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
    label = "Saving..."
  } else if (status === "saved") {
    tone = "border-border bg-muted text-muted-foreground"
    icon = <Check className="h-4 w-4" aria-hidden />
    label = "All changes saved"
  } else if (status === "error") {
    tone = "border-destructive/40 bg-destructive/5 text-destructive"
    icon = <AlertCircle className="h-4 w-4" aria-hidden />
    label = "Save failed"
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`sticky bottom-0 z-30 -mx-4 mt-4 flex items-center justify-between gap-3 border-t px-4 py-2 text-sm ${tone}`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      {status === "error" && onRetry && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetry}
          aria-label="Retry save"
        >
          Retry
        </Button>
      )}
    </div>
  )
}

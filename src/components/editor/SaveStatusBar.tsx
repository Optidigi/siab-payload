"use client"
import { useEffect, useRef, useState } from "react"
import { Loader2, AlertCircle, CheckCircle2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * SaveStatusBar — floating top-right status pill that reflects the
 * page-form's save lifecycle and exposes inline Save / Retry / jump-
 * to-error affordances.
 *
 * Visual states:
 *   idle              -> hidden
 *   dirty             -> amber pill, "{n} unsaved" + inline Save button
 *                        (briefly pulses on the idle->dirty transition)
 *   saving            -> muted pill, spinner + "Saving..."
 *   saved             -> green pill, "Saved" — fades out after 4s
 *   error             -> red pill, either "Save blocked: N issues"
 *                        (clickable, jumps to first invalid field)
 *                        or "Save failed" + Retry button for non-field
 *                        server errors
 *
 * The pill is `fixed top-4 right-4 z-40` on >= sm screens and falls
 * back to a bottom strip on small viewports so it doesn't fight
 * mobile thumb zones. Z-index 40 sits below shadcn Dialog (z-50),
 * which is what we want — modals cover the pill.
 *
 * The bar is UI-only: navigation guarding is handled by
 * `useNavigationGuard` mounted by the parent form.
 */
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"

type Props = {
  status: SaveStatus
  dirtyCount?: number
  errorCount?: number
  onSave: () => void
  onRetry?: () => void
  onJumpToError?: () => void
}

export function SaveStatusBar({
  status,
  dirtyCount,
  errorCount = 0,
  onSave,
  onRetry,
  onJumpToError
}: Props) {
  // Hide the "saved" tick after a delay so the pill doesn't linger.
  // We keep the element mounted during the fade for a cleaner
  // transition.
  const [showSaved, setShowSaved] = useState(false)
  const [savedFading, setSavedFading] = useState(false)
  useEffect(() => {
    if (status === "saved") {
      setShowSaved(true)
      setSavedFading(false)
      const fade = setTimeout(() => setSavedFading(true), 3500)
      const hide = setTimeout(() => setShowSaved(false), 4000)
      return () => {
        clearTimeout(fade)
        clearTimeout(hide)
      }
    }
    setShowSaved(false)
    setSavedFading(false)
  }, [status])

  // Pulse on the idle -> dirty transition only. Watching every status
  // change with a ref keeps us from pulsing on every keystroke (RHF
  // re-renders frequently while staying in "dirty").
  const prevStatus = useRef<SaveStatus>(status)
  const [pulsing, setPulsing] = useState(false)
  useEffect(() => {
    if (prevStatus.current !== "dirty" && status === "dirty") {
      setPulsing(true)
      const t = setTimeout(() => setPulsing(false), 3000)
      prevStatus.current = status
      return () => clearTimeout(t)
    }
    prevStatus.current = status
  }, [status])

  if (status === "idle") return null
  if (status === "saved" && !showSaved) return null

  // Position: top-right desktop, bottom strip on mobile.
  const positionClasses =
    "fixed bottom-4 left-4 right-4 z-40 sm:bottom-auto sm:left-auto sm:top-4 sm:right-4"

  let tone = "border bg-muted text-muted-foreground"
  let body: React.ReactNode = null
  let label = ""
  let isClickableJump = false

  if (status === "dirty") {
    tone =
      "border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
    label = dirtyCount && dirtyCount > 0 ? `${dirtyCount} unsaved` : "Unsaved"
    body = (
      <>
        <AlertCircle className="h-4 w-4" aria-hidden />
        <span>{label}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onSave}
          aria-label="Save changes"
          className="ml-1 h-7"
        >
          <Save className="mr-1 h-3.5 w-3.5" aria-hidden />
          Save
        </Button>
      </>
    )
  } else if (status === "saving") {
    tone = "border border-border bg-muted text-muted-foreground"
    label = "Saving..."
    body = (
      <>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>{label}</span>
      </>
    )
  } else if (status === "saved") {
    tone =
      "border border-green-500/40 bg-green-500/15 text-green-700 dark:text-green-300"
    label = "Saved"
    body = (
      <>
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        <span>{label}</span>
      </>
    )
  } else if (status === "error") {
    tone =
      "border border-destructive/40 bg-destructive/15 text-destructive"
    if (errorCount > 0) {
      label = `Save blocked: ${errorCount} ${errorCount === 1 ? "issue" : "issues"}`
      isClickableJump = Boolean(onJumpToError)
      body = (
        <>
          <AlertCircle className="h-4 w-4" aria-hidden />
          <span>{label}</span>
        </>
      )
    } else {
      label = "Save failed"
      body = (
        <>
          <AlertCircle className="h-4 w-4" aria-hidden />
          <span>{label}</span>
          {onRetry && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRetry}
              aria-label="Retry save"
              className="ml-1 h-7"
            >
              Retry
            </Button>
          )}
        </>
      )
    }
  }

  const baseClasses =
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm shadow-md backdrop-blur"

  // animate-pulse modulates opacity which can fight the saved-fade
  // logic. Restrict it to dirty status, where there's no fade.
  const pulseClass = pulsing && status === "dirty" ? "animate-pulse" : ""

  // Saved-fade: keep the element mounted while opacity transitions.
  const fadeClass =
    status === "saved"
      ? cn("transition-opacity duration-500", savedFading && "opacity-0")
      : ""

  if (isClickableJump) {
    return (
      <button
        type="button"
        role="status"
        aria-live="polite"
        aria-label={label}
        onClick={onJumpToError}
        className={cn(
          positionClasses,
          baseClasses,
          tone,
          pulseClass,
          fadeClass,
          "cursor-pointer hover:opacity-90"
        )}
      >
        {body}
      </button>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(positionClasses, baseClasses, tone, pulseClass, fadeClass)}
    >
      {body}
    </div>
  )
}

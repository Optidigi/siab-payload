"use client"
import { useEffect, useState } from "react"
import { Loader2, AlertCircle, CheckCircle2, Save, Eye, EyeOff, Maximize } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type PreviewMode = "hidden" | "side" | "fullscreen"

/**
 * SaveStatusBar — floating top-right status pill that reflects the
 * page-form's save lifecycle and exposes inline Save / Retry / jump-
 * to-error affordances.
 *
 * Visual states:
 *   idle              -> hidden
 *   dirty             -> amber pill, "{n} unsaved" + inline Save button
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
  previewMode?: PreviewMode
  setPreviewMode?: (m: PreviewMode) => void
}

export function SaveStatusBar({
  status,
  dirtyCount,
  errorCount = 0,
  onSave,
  onRetry,
  onJumpToError,
  previewMode,
  setPreviewMode
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

  // Preview-mode toggle is rendered as a sibling so it stays visible even
  // when the save pill is "idle". When the pill is hidden we still render
  // the toggle alone in the same position.
  const previewToggle =
    setPreviewMode && previewMode !== undefined ? (
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={() => {
          const next: Record<PreviewMode, PreviewMode> = {
            hidden: "side",
            side: "fullscreen",
            fullscreen: "hidden",
          }
          setPreviewMode(next[previewMode])
        }}
        aria-label={
          previewMode === "hidden"
            ? "Show preview"
            : previewMode === "side"
            ? "Fullscreen preview"
            : "Hide preview"
        }
        title={
          previewMode === "hidden"
            ? "Show preview"
            : previewMode === "side"
            ? "Fullscreen preview"
            : "Hide preview"
        }
        // Phone-first: 44×44 thumb target on <md, shrink on md+ to match
        // the desktop pill density.
        className="h-11 w-11 md:h-7 md:w-7"
      >
        {previewMode === "hidden" && <Eye className="h-5 w-5 md:h-3.5 md:w-3.5" />}
        {previewMode === "side" && <Maximize className="h-5 w-5 md:h-3.5 md:w-3.5" />}
        {previewMode === "fullscreen" && <EyeOff className="h-5 w-5 md:h-3.5 md:w-3.5" />}
      </Button>
    ) : null

  // Hidden states: pill not rendered, but if a preview toggle is provided
  // we still surface it in the same anchored position so the operator can
  // toggle the preview pane independent of save state.
  //
  // Phone: this entire bar is suppressed (`hidden md:flex` on every
  // returned root). The bottom-anchored mobile branch collided with the
  // new tabbar; on phone the tabbar's Edit-tab dot now carries the
  // save state. The desktop top-right pill is unchanged.
  if (status === "idle" || (status === "saved" && !showSaved)) {
    if (!previewToggle) return null
    return (
      <div
        className={cn(
          "hidden fixed z-40 md:flex md:bottom-auto md:left-auto md:top-16 md:right-4",
          "items-center gap-1 rounded-md border bg-card/80 px-2 py-1 shadow-sm backdrop-blur",
        )}
      >
        {previewToggle}
      </div>
    )
  }

  // Position: top-right on desktop (clears the 48px sticky SiteHeader at z-10
  // by anchoring at top-16 = 64px → 16px gap below the header). On phone
  // the bar is fully suppressed via `hidden md:flex`.
  const positionClasses =
    "hidden fixed z-40 md:flex md:bottom-auto md:left-auto md:top-16 md:right-4"

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

  // Saved-fade: keep the element mounted while opacity transitions.
  const fadeClass =
    status === "saved"
      ? cn("transition-opacity duration-500", savedFading && "opacity-0")
      : ""

  // The pill itself doesn't include the preview toggle (different visual
  // treatment); instead we wrap pill + toggle in a flex container so they
  // sit side-by-side at the same anchor.
  const pill = isClickableJump ? (
    <button
      type="button"
      role="status"
      aria-live="polite"
      aria-label={label}
      onClick={onJumpToError}
      className={cn(
        baseClasses,
        tone,
        fadeClass,
        "cursor-pointer hover:opacity-90"
      )}
    >
      {body}
    </button>
  ) : (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(baseClasses, tone, fadeClass)}
    >
      {body}
    </div>
  )

  if (!previewToggle) {
    return <div className={positionClasses}>{pill}</div>
  }

  return (
    <div className={cn(positionClasses, "md:items-center md:gap-2")}>
      {pill}
      <div className="flex items-center rounded-md border bg-card/80 px-1 py-1 shadow-sm backdrop-blur">
        {previewToggle}
      </div>
    </div>
  )
}

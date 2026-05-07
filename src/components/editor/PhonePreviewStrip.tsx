"use client"
import { useEffect, useRef } from "react"
import { ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PreviewStatus } from "./PreviewToolbar"

type Props = {
  status: PreviewStatus
  errorMessage?: string
  pageTitle?: string
  onOpen: () => void
}

export function PhonePreviewStrip({ status, errorMessage, pageTitle, onOpen }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // Publish strip height as `--mini-strip-h` so editor content padding-bottom can clear it.
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty("--mini-strip-h", `${Math.ceil(h)}px`)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty("--mini-strip-h")
    }
  }, [])

  const dotClass =
    status === "ready" ? "bg-green-500" :
    status === "loading" ? "bg-amber-500 animate-pulse" :
    status === "reconnecting" ? "bg-amber-500 animate-pulse" :
    "bg-destructive"
  const statusLabel =
    status === "ready" ? "Live" :
    status === "loading" ? "Loading…" :
    status === "reconnecting" ? "Reconnecting…" :
    `Error${errorMessage ? `: ${errorMessage}` : ""}`

  return (
    <div
      ref={ref}
      // Position above the home-indicator (safe-area-inset-bottom) instead
      // of overlapping it with internal pb-safe-area. This keeps the entire
      // 56px strip tappable + visible, and lets consumers (FAB, editor
      // pb, Toaster offset) compute clearance as
      // `var(--mini-strip-h) + env(safe-area-inset-bottom)` without
      // double-counting the inset (the strip itself sat 34px lower
      // visually before this change on iPhone X+).
      style={{ bottom: "env(safe-area-inset-bottom)" }}
      className="md:hidden fixed inset-x-0 z-30 flex items-center gap-3 h-14 px-4 border-t bg-background"
      onPointerDown={(e) => { e.preventDefault() }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label="Open preview"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen() }
      }}
    >
      <span className={cn("h-2 w-2 rounded-full shrink-0", dotClass)} aria-hidden />
      <div className="flex-1 min-w-0 truncate text-sm">
        <span className="text-muted-foreground">Preview · </span>
        <span className={cn(status === "error" && "text-destructive")}>{statusLabel}</span>
        {pageTitle && status === "ready" && (
          <span className="text-muted-foreground"> · {pageTitle}</span>
        )}
      </div>
      <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </div>
  )
}

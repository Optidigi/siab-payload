"use client"
import { useEffect, useRef } from "react"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { tinyVibrate } from "@/lib/haptics"
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
    status === "loading" ? "bg-amber-500 ring-2 ring-amber-400/40 ring-offset-1" :
    status === "reconnecting" ? "bg-amber-500 ring-2 ring-amber-400/40 ring-offset-1" :
    "bg-destructive"

  const line1 =
    status === "loading" ? "Preview · Loading…" :
    status === "reconnecting" ? "Preview · Reconnecting…" :
    status === "error" ? `Preview · Error${errorMessage ? `: ${errorMessage}` : ""}` :
    "Live preview"

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
      className="phone-preview-strip md:hidden fixed inset-x-0 z-30 flex items-center gap-3 h-14 px-4 border-t border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 active:scale-[0.98] transition-transform duration-150 ease-out"
      onPointerDown={(e) => { e.preventDefault() }}
      onClick={() => { tinyVibrate(8); onOpen() }}
      role="button"
      tabIndex={0}
      aria-label="Open preview"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen() }
      }}
    >
      {/* Eye icon chip */}
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 shrink-0" aria-hidden>
        <Eye className="h-4 w-4 text-muted-foreground" />
      </span>

      {/* Two-line type hierarchy */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "h-2 w-2 rounded-full shrink-0",
            dotClass
          )} aria-hidden />
          <p className={cn(
            "text-[13px] font-medium tracking-tight truncate",
            status === "error" && "text-destructive"
          )}>
            {line1}
          </p>
        </div>
        {pageTitle && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {pageTitle}
          </p>
        )}
      </div>
    </div>
  )
}

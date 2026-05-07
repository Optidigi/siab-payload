"use client"
import { Smartphone, Monitor, Maximize2, Expand, Shrink, ExternalLink, RotateCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PreviewMode } from "./SaveStatusBar"

export type ViewportMode = "mobile" | "laptop" | "full"
export type PreviewStatus = "loading" | "ready" | "reconnecting" | "error"

type Props = {
  status: PreviewStatus
  errorMessage?: string
  viewport: ViewportMode
  setViewport: (m: ViewportMode) => void
  onRefresh: () => void
  onOpenInNewTab: () => void
  previewMode: PreviewMode
  setPreviewMode: (m: PreviewMode) => void
}

export function PreviewToolbar({
  status,
  errorMessage,
  viewport,
  setViewport,
  onRefresh,
  onOpenInNewTab,
  previewMode,
  setPreviewMode,
}: Props) {
  const dotClass =
    status === "ready"
      ? "bg-green-500"
      : status === "loading"
      ? "bg-amber-500 animate-pulse"
      : status === "reconnecting"
      ? "bg-amber-500 animate-pulse"
      : "bg-destructive"

  const label =
    status === "ready"
      ? "Live"
      : status === "loading"
      ? "Loading preview..."
      : status === "reconnecting"
      ? "Reconnecting..."
      : `Error${errorMessage ? `: ${errorMessage}` : ""}`

  return (
    <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("h-2 w-2 rounded-full shrink-0", dotClass)} aria-hidden />
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        {/* Viewport switcher — hidden on <md (no mouse-pointer affordance,
            and the phone is a phone). Re-shows at md+ where it's useful. */}
        <div className="hidden md:flex items-center gap-1">
          <Button
            variant={viewport === "mobile" ? "secondary" : "ghost"}
            size="icon"
            className={cn("h-7 w-7", viewport === "mobile" && "ring-1 ring-primary ring-offset-1 ring-offset-background")}
            onClick={() => setViewport("mobile")}
            aria-label="Mobile viewport (375px)"
            title="Mobile viewport (375px)"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewport === "laptop" ? "secondary" : "ghost"}
            size="icon"
            className={cn("h-7 w-7", viewport === "laptop" && "ring-1 ring-primary ring-offset-1 ring-offset-background")}
            onClick={() => setViewport("laptop")}
            aria-label="Laptop viewport (1024px)"
            title="Laptop viewport (1024px)"
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewport === "full" ? "secondary" : "ghost"}
            size="icon"
            className={cn("h-7 w-7", viewport === "full" && "ring-1 ring-primary ring-offset-1 ring-offset-background")}
            onClick={() => setViewport("full")}
            aria-label="Full viewport (no max-width)"
            title="Full viewport (no max-width)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        </div>
        {/* Fullscreen-mode toggle — uses Expand/Shrink (distinct from the
            Maximize2 used by the viewport "full" button just above, so the
            two don't visually collide). */}
        {previewMode === "side" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPreviewMode("fullscreen")}
            aria-label="Hide editor — fullscreen preview"
            title="Hide editor — fullscreen preview"
          >
            <Expand className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPreviewMode("side")}
            aria-label="Exit fullscreen"
            title="Exit fullscreen"
          >
            <Shrink className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setPreviewMode("hidden")}
          aria-label="Hide preview"
          title="Hide preview"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} aria-label="Refresh preview">
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="hidden md:inline-flex h-7 w-7" onClick={onOpenInNewTab} aria-label="Open preview in new tab">
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

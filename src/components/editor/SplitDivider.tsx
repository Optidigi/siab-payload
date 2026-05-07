"use client"
import { useRef } from "react"
import { cn } from "@/lib/utils"

type Props = {
  pct: number  // 20-80
  setPct: (p: number) => void
  iframeWrapperRef: React.RefObject<HTMLDivElement | null>
  isDragging: boolean
  setIsDragging: (b: boolean) => void
}

const SNAP_POINTS = [40, 50, 60]

/**
 * Snap-on-release. The 42-58 deadband always pulls to 50 — the most common
 * "just give me even halves" gesture. Outside the deadband we still snap to
 * the nearest of {40,50,60} when within 6 percentage points; further out we
 * round to the nearest 5% so coarse drags still land on tidy values.
 */
function snapTo(pct: number): number {
  if (pct >= 42 && pct <= 58) return 50
  let best = SNAP_POINTS[0]!
  let bestDist = Math.abs(pct - best)
  for (const p of SNAP_POINTS) {
    const d = Math.abs(pct - p)
    if (d < bestDist) { best = p; bestDist = d }
  }
  return Math.abs(pct - best) <= 6 ? best : Math.round(pct / 5) * 5
}

/**
 * Vertical drag-to-resize divider for the side-by-side preview. Uses
 * pointer events with setPointerCapture so the drag survives if the cursor
 * leaves the divider's box. We ALSO disable pointer-events on the iframe
 * wrapper while dragging because Chrome/Edge sometimes route move events to
 * the iframe before pointer-capture binds — belt+braces.
 *
 * Keyboard a11y: Arrow keys nudge ±5% within the [20, 80] clamp.
 */
export function SplitDivider({ pct, setPct, iframeWrapperRef, isDragging, setIsDragging }: Props) {
  const dragStateRef = useRef<{ startX: number; startPct: number; lastPct: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragStateRef.current = { startX: e.clientX, startPct: pct, lastPct: pct }
    setIsDragging(true)
    if (iframeWrapperRef.current) iframeWrapperRef.current.style.pointerEvents = "none"
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStateRef.current) return
    const deltaX = e.clientX - dragStateRef.current.startX
    // Dragging LEFT shrinks the editor area, growing the preview. The
    // overlay is right-anchored, so a left-drag means a higher pct.
    const deltaPct = (deltaX / window.innerWidth) * -100
    const next = Math.max(20, Math.min(80, dragStateRef.current.startPct + deltaPct))
    dragStateRef.current.lastPct = next
    setPct(next)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStateRef.current) return
    const finalPct = dragStateRef.current.lastPct
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    setPct(snapTo(finalPct))
    dragStateRef.current = null
    setIsDragging(false)
    if (iframeWrapperRef.current) iframeWrapperRef.current.style.pointerEvents = ""
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault()
      const delta = e.key === "ArrowLeft" ? 5 : -5
      setPct(Math.max(20, Math.min(80, pct + delta)))
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={20}
      aria-valuemax={80}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        "fixed top-0 bottom-0 z-30 flex items-center justify-center cursor-col-resize",
        "w-2 -ml-1 hover:bg-primary/20 transition-colors",
        isDragging && "bg-primary/30",
      )}
      style={{ right: `${pct}%` }}
    >
      <div className="h-12 w-[3px] rounded-full bg-border" />
    </div>
  )
}

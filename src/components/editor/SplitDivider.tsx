"use client"
import { useRef } from "react"
import { cn } from "@/lib/utils"

type Props = {
  pct: number  // 20-60
  setPct: (p: number) => void
  iframeWrapperRef: React.RefObject<HTMLDivElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  isDragging: boolean
  setIsDragging: (b: boolean) => void
}

const SNAP_POINTS = [30, 40, 50, 60]

/**
 * Snap-on-release. Each of the four snap points has a uniform ±2pp deadband:
 *   [28,32] → 30, [38,42] → 40, [48,52] → 50, [58,62] → 60.
 * Outside any deadband: round to nearest integer.
 */
function snapTo(pct: number): number {
  for (const p of SNAP_POINTS) {
    if (pct >= p - 2 && pct <= p + 2) return p
  }
  return Math.round(pct)
}

/**
 * Vertical drag-to-resize divider for the side-by-side preview. Lives
 * in-flow as a flex-shrink-0 column between the editor and preview, so
 * its position is determined by sibling widths rather than a `fixed`
 * `right: ${pct}%` style.
 *
 * Pointer events with setPointerCapture so the drag survives if the
 * cursor leaves the divider's box. We ALSO disable pointer-events on
 * the preview wrapper while dragging because Chrome/Edge sometimes route
 * move events to the iframe before pointer-capture binds — belt+braces.
 *
 * Drag delta is computed against the form container's width (not
 * window.innerWidth) so a fixed-width sidebar or future zoom doesn't
 * skew the percent math.
 *
 * Keyboard a11y: Arrow keys nudge ±5% within the [20, 60] clamp.
 */
export function SplitDivider({ pct, setPct, iframeWrapperRef, containerRef, isDragging, setIsDragging }: Props) {
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
    // preview column is right-anchored in flex order, so a left-drag
    // means a higher pct.
    const containerWidth = containerRef.current?.getBoundingClientRect().width ?? window.innerWidth
    const deltaPct = (deltaX / containerWidth) * -100
    const next = Math.max(20, Math.min(60, dragStateRef.current.startPct + deltaPct))
    dragStateRef.current.lastPct = next
    setPct(next)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStateRef.current) return
    const finalPct = dragStateRef.current.lastPct
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    // Clamp the snapped result too so a snap target outside [20,60]
    // never escapes the new range.
    setPct(Math.max(20, Math.min(60, snapTo(finalPct))))
    dragStateRef.current = null
    setIsDragging(false)
    if (iframeWrapperRef.current) iframeWrapperRef.current.style.pointerEvents = ""
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault()
      const delta = e.key === "ArrowLeft" ? 5 : -5
      setPct(Math.max(20, Math.min(60, pct + delta)))
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={20}
      aria-valuemax={60}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      className={cn(
        "relative w-2 self-stretch flex-shrink-0 z-10 flex items-center justify-center cursor-col-resize",
        "hover:bg-primary/20 transition-colors",
        isDragging && "bg-primary/30",
      )}
    >
      <div className="h-12 w-[3px] rounded-full bg-border" />
    </div>
  )
}

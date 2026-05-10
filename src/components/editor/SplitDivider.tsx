"use client"
import { useRef } from "react"
import { GripVertical } from "lucide-react"
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
const MIN_PCT = 20
const MAX_PCT = 60

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
 * FN-2026-0064 — SplitDivider redesign. Pre-fix the divider was a thin
 * 8px column with a 48px gray pill always in the center; while dragging
 * the entire 8px column tinted in primary/30 — fat tinted bar with no
 * indication of WHERE the divider line will land. Operator feedback:
 * "ugly and works counterintuitively."
 *
 * Post-fix UX:
 *   - Always-visible thin (1px) center line so the operator can see the
 *     editor/preview boundary at a glance.
 *   - Center grip dot using shadcn's GripVertical icon — a clear
 *     "drag me" affordance instead of an ambiguous gray pill.
 *   - Hover: the line thickens to 2px and tints with `bg-primary/40`,
 *     grip dot tints with `text-primary`. No fat full-column shading.
 *   - Drag: the line is solid `bg-primary`, plus a small tooltip-style
 *     pill near the top showing the current percentage (e.g. "42%")
 *     so the operator knows EXACTLY where the divider will land before
 *     releasing.
 *   - Snap-point markers (4 small dots along the line) fade in during
 *     drag at 30/40/50/60% — visual hints for the snap deadbands.
 *
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
 * Keyboard a11y: Arrow keys nudge ±5% within the [MIN_PCT, MAX_PCT] clamp.
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
    const next = Math.max(MIN_PCT, Math.min(MAX_PCT, dragStateRef.current.startPct + deltaPct))
    dragStateRef.current.lastPct = next
    setPct(next)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragStateRef.current) return
    const finalPct = dragStateRef.current.lastPct
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    // Clamp the snapped result too so a snap target outside [MIN_PCT,MAX_PCT]
    // never escapes the new range.
    setPct(Math.max(MIN_PCT, Math.min(MAX_PCT, snapTo(finalPct))))
    dragStateRef.current = null
    setIsDragging(false)
    if (iframeWrapperRef.current) iframeWrapperRef.current.style.pointerEvents = ""
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault()
      const delta = e.key === "ArrowLeft" ? 5 : -5
      setPct(Math.max(MIN_PCT, Math.min(MAX_PCT, pct + delta)))
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={MIN_PCT}
      aria-valuemax={MAX_PCT}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      // Hit area is wider than the visible line for forgiving targeting,
      // but pointer-cursor and visuals stay precisely on the line itself.
      className={cn(
        "group relative w-3 self-stretch flex-shrink-0 z-10 cursor-col-resize",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
      )}
    >
      {/* Always-visible thin center line — the actual divider. */}
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all",
          isDragging
            ? "w-[2px] bg-primary"
            : "w-px bg-border group-hover:w-[2px] group-hover:bg-primary/60 group-focus-visible:w-[2px] group-focus-visible:bg-primary/60",
        )}
        aria-hidden
      />
      {/* Snap-point ticks along the line. Hidden by default; fade in
          while dragging so the operator sees where the snaps are. */}
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] pointer-events-none transition-opacity",
          isDragging ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      >
        {SNAP_POINTS.map((p) => (
          <span
            key={p}
            className="absolute left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary/60"
            style={{ top: `${100 - p}%` }}
          />
        ))}
      </div>
      {/* Center grip — visible affordance hint that this column is
          interactive. Tints on hover/focus to read as "draggable". */}
      <span
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "flex items-center justify-center h-12 w-5 rounded-md",
          "bg-background border border-transparent transition-colors",
          isDragging
            ? "border-primary text-primary bg-background"
            : "text-muted-foreground/70 group-hover:text-primary group-hover:border-primary/40 group-focus-visible:text-primary group-focus-visible:border-primary/40",
        )}
        aria-hidden
      >
        <GripVertical className="h-4 w-4" />
      </span>
      {/* Live percentage pill while dragging. Sits above the grip so the
          operator sees the exact split they're about to commit. */}
      {isDragging && (
        <div
          className={cn(
            "absolute top-2 left-1/2 -translate-x-1/2",
            "rounded-md border bg-background px-2 py-0.5 text-xs font-medium shadow-sm",
            "pointer-events-none whitespace-nowrap",
          )}
          aria-hidden
        >
          {Math.round(pct)}%
        </div>
      )}
    </div>
  )
}

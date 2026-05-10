"use client"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Hover-revealed thin "+ Add block" bar rendered between adjacent blocks
 * in the BlockEditor. Clicking opens the block-type picker via `onClick`,
 * and the parent passes the target index so insertion lands at the slot
 * location (not always at the end).
 *
 * Always rendered, but the visual bar only fades in on hover/focus —
 * keeping the tree calm when an operator is just scanning the page.
 * Keyboard users get focus styling because the wrapper is a real button.
 */
export function InsertSlot({ onClick, label = "Add" }: { onClick: () => void; label?: string }) {
  return (
    // Wrapper height stays small (h-2 desktop, h-2.5 mobile) so the visual
    // gap between blocks remains the "very thin small" affordance issue #13
    // asks for. The absolutely positioned button extends OUTSIDE the wrapper
    // line on mobile to give a 44-px tap target (U1 floor) without inflating
    // the visual gap. On desktop the original hover-reveal pill height stays.
    <div className="group relative flex h-2 max-md:h-2.5 items-center">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          // U8 (UX-2026-0030) — `[@media(hover:none)]:opacity-100` was
          // unreliable: Chromium reports `hover: hover` even at 375 px
          // viewport in devtools-mobile mode + on some real touch devices
          // with mouse-over-touch. Tying visibility to the `md` breakpoint
          // (`max-md:opacity-100`) captures the actual UX dimension —
          // phone always shows the affordance; desktop keeps the subtle
          // hover-reveal per issue #13's design intent.
          "absolute inset-x-0 flex items-center justify-center opacity-0 transition-opacity duration-100 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100",
          // U1 — 44-px hit target on mobile via padding above + below the
          // wrapper line. Visual pill (the inner <span>) stays small, but
          // the BUTTON itself is tall enough to tap reliably.
          "max-md:h-11 max-md:-my-4"
        )}
      >
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-xs text-muted-foreground shadow-sm hover:border-primary hover:text-primary",
          "max-md:bg-foreground max-md:text-background max-md:border-foreground",
          "max-md:text-sm max-md:px-4 max-md:py-1 max-md:gap-1.5",
        )}>
          <Plus className="h-3 w-3 max-md:h-4 max-md:w-4" />
          {label}
        </span>
      </button>
    </div>
  )
}

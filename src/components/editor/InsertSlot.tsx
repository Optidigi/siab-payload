"use client"
import { Plus } from "lucide-react"

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
export function InsertSlot({ onClick, label = "Add block" }: { onClick: () => void; label?: string }) {
  return (
    <div className="group relative flex h-2 items-center">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        // Hover-reveal on pointer devices; permanently visible on touch (no
        // hover state to trigger the reveal). Without this, touch users
        // would only have the trailing "+ Add block" button and couldn't
        // insert between existing blocks at all.
        className="absolute inset-x-0 flex items-center justify-center opacity-0 transition-opacity duration-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <span className="flex items-center gap-1 rounded-full border border-dashed border-border bg-background px-2 py-0.5 text-xs text-muted-foreground shadow-sm hover:border-primary hover:text-primary">
          <Plus className="h-3 w-3" />
          {label}
        </span>
      </button>
    </div>
  )
}

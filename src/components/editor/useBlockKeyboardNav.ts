"use client"
import { useCallback } from "react"

/**
 * Keyboard reorder for the top-level block list. Returns props you spread
 * onto the block row container. When the row is focused (or a child fires
 * a bubbling keydown):
 *
 *   ArrowUp        -> move up one slot (or no-op at index 0)
 *   ArrowDown      -> move down one slot (or no-op at last index)
 *   Cmd/Ctrl+ArrowUp   -> move to top
 *   Cmd/Ctrl+ArrowDown -> move to bottom
 *
 * The hook calls preventDefault() so the page doesn't scroll. Bubbled
 * keydowns from inputs are ignored (we don't want typing in a Hero
 * headline to reorder blocks).
 */
export function useBlockKeyboardNav({
  index,
  total,
  move
}: {
  index: number
  total: number
  move: (from: number, to: number) => void
}) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ignore keys originating from text inputs / textareas / contenteditable
      // — operators editing field values shouldn't trigger a reorder.
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return
      }
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
      const meta = e.metaKey || e.ctrlKey
      if (e.key === "ArrowUp") {
        e.preventDefault()
        const to = meta ? 0 : Math.max(0, index - 1)
        if (to !== index) move(index, to)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        const to = meta ? total - 1 : Math.min(total - 1, index + 1)
        if (to !== index) move(index, to)
      }
    },
    [index, total, move]
  )

  return { onKeyDown, tabIndex: 0 }
}

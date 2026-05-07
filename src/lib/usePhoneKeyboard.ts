"use client"
import { useEffect } from "react"

/**
 * Tracks whether the on-screen keyboard is open and toggles the
 * `data-kb-open` attribute on `<html>`. Consumers gate their visibility
 * via a CSS rule like `html[data-kb-open] .phone-fab { display: none }`.
 *
 * Uses `window.visualViewport.height` vs `window.innerHeight` with a
 * 150px threshold to filter iOS Safari bottom-bar autohide jitter.
 *
 * Side effects:
 *  - Sets/removes `data-kb-open` on `<html>` (boolean attribute).
 *  - Sets `--mini-strip-h: 0px` while keyboard is open so consumers
 *    relying on this var (FAB position, editor pb, Toaster offset)
 *    automatically reflow without their own listeners. The
 *    PhonePreviewStrip ResizeObserver re-publishes the correct value
 *    when the keyboard closes and the strip becomes visible again.
 *
 * SSR-safe: all browser API reads are inside the useEffect.
 */
export function usePhoneKeyboard(): void {
  useEffect(() => {
    if (typeof window === "undefined") return
    const vv = window.visualViewport
    if (!vv) return

    const root = document.documentElement
    let raf = 0
    const update = () => {
      // Coalesce multiple resize ticks during keyboard animation.
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const kbOpen = window.innerHeight - vv.height > 150
        if (kbOpen) {
          root.setAttribute("data-kb-open", "")
          // Strip goes display:none via the `data-[kb-open]:hidden` selector,
          // so its ResizeObserver doesn't fire to update the var. Force it
          // to 0 so consumers (FAB, editor pb) collapse cleanly.
          root.style.setProperty("--mini-strip-h", "0px")
        } else {
          root.removeAttribute("data-kb-open")
          // Don't reset --mini-strip-h here; let the strip's own
          // ResizeObserver reset it when it remounts/becomes visible.
        }
      })
    }
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    update()
    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
      root.removeAttribute("data-kb-open")
    }
  }, [])
}

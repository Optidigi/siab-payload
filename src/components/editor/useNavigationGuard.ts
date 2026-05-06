"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Block accidental navigation while a form has unsaved work.
 *
 * Pass `when={true}` whenever the user has dirty state (or a save is
 * in flight). The hook installs two listeners:
 *
 *  1. A `beforeunload` listener that triggers the browser's native
 *     "Leave site?" prompt.
 *  2. A capture-phase document-level click listener that intercepts
 *     internal `<a>` / `<Link>` clicks and asks for confirmation
 *     before letting Next.js's router push the new route.
 *
 * Catches:
 *  - tab/window close
 *  - F5 / hard refresh
 *  - typing a new URL into the address bar
 *  - browser back/forward to an off-site origin
 *  - in-app `<Link>` and `<a>` clicks within the SPA
 *
 * Bypass cases (the click guard does NOT block these):
 *  - external links (different origin)
 *  - `target="_blank"` anchors
 *  - modifier-key clicks (Ctrl/Cmd/Shift) — preserves middle-click /
 *    open-in-new-tab behaviour
 *  - anchors with `data-skip-nav-guard="true"` — escape hatch for
 *    in-dialog anchors and any other UI that needs to bypass the
 *    confirm prompt
 *  - anchors with no real `href` (e.g. `role="button"` shells)
 *
 * The `message` argument is mostly cosmetic for `beforeunload` —
 * modern browsers ignore the custom string and show their own copy.
 * For the click confirm we use `window.confirm`, which DOES show the
 * message.
 */
export function useNavigationGuard(
  when: boolean,
  message: string = "You have unsaved changes. Leave anyway?"
): void {
  const router = useRouter()

  useEffect(() => {
    if (!when) return

    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // returnValue is the load-bearing piece; the string is ignored by
      // most browsers but some legacy ones still surface it.
      e.returnValue = message
    }

    const onClick = (e: MouseEvent) => {
      // `when` is closed-over; this listener is only registered when
      // `when` is true, but we guard defensively in case React re-runs.
      if (!when) return

      // Modifier keys mean "open in new tab" / "download" / "save" —
      // never block those.
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
      // Only left-button clicks navigate.
      if (e.button !== 0) return

      // Find the nearest <a> ancestor. composedPath() is friendlier to
      // shadow DOM, but closest() is sufficient for our DOM and easier
      // to reason about.
      const target = e.target as Element | null
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null
      if (!anchor) return

      // Escape hatch for any UI that needs to opt out (dialog content,
      // future special cases).
      if (anchor.dataset.skipNavGuard === "true") return
      if (anchor.closest("[data-skip-nav-guard='true']")) return

      // No href / role=button shells — let those run their own onClick.
      const href = anchor.getAttribute("href")
      if (!href) return

      // External target (new tab/window) — let it through.
      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") return

      // Cross-origin — browser handles its own unload, beforeunload
      // covers it.
      if (anchor.origin !== window.location.origin) return

      // Same-origin in-app navigation: intercept and confirm.
      e.preventDefault()
      e.stopPropagation()
      if (window.confirm(message)) {
        // Use Next.js's client router so we don't full-page reload.
        router.push(anchor.pathname + anchor.search + anchor.hash)
      }
    }

    window.addEventListener("beforeunload", beforeUnload)
    // Capture phase is non-negotiable — Next.js's <Link> registers its
    // own click handler that intercepts before any document-level
    // bubble-phase listener can run.
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [when, message, router])
}

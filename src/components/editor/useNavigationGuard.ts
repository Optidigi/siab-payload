"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Block accidental navigation while a form has unsaved work.
 *
 * Pass `when={true}` whenever the user has dirty state (or a save is
 * in flight). The hook installs three listeners:
 *
 *  1. A `beforeunload` listener that triggers the browser's native
 *     "Leave site?" prompt (mandatory native dialog — no API to
 *     substitute a custom one for tab close / hard refresh / address-
 *     bar nav).
 *  2. A capture-phase document-level click listener that intercepts
 *     internal `<a>` / `<Link>` clicks and surfaces a custom dialog
 *     before letting Next.js's router push the new route.
 *  3. A `popstate` listener that catches browser back/forward via the
 *     classic sentinel-pushState pattern: when the hook arms with
 *     `when=true`, we push a duplicate history entry, then restore the
 *     URL on every popstate (re-pushing the sentinel) and surface the
 *     same custom dialog instead.
 *
 * The custom dialog is rendered by the consumer using the returned
 * `pending` / `confirm` / `cancel` shape — this hook is headless.
 *
 * Catches:
 *  - tab/window close                     (beforeunload, native dialog)
 *  - F5 / hard refresh                    (beforeunload, native dialog)
 *  - typing a new URL into the address bar (beforeunload)
 *  - in-app `<Link>` and `<a>` clicks within the SPA (custom dialog)
 *  - browser back/forward (via popstate-pushState pattern, custom dialog)
 *
 * Trade-off: confirming "Discard changes" on a popstate dialog uses
 * `router.push(destination)` rather than `history.go(-N)` — that adds
 * one extra entry to history (the editor URL stays in the back stack
 * one position deep). Acceptable; in exchange we avoid back/forward
 * direction-counting and its edge cases.
 *
 * Bypass cases (the click guard does NOT block these):
 *  - external links (different origin)
 *  - `target="_blank"` anchors
 *  - modifier-key clicks (Ctrl/Cmd/Shift) — preserves middle-click /
 *    open-in-new-tab behaviour
 *  - anchors with `data-skip-nav-guard="true"` — escape hatch for
 *    in-dialog anchors and any other UI that needs to bypass the
 *    confirm prompt (also honored on any ancestor)
 *  - anchors with no real `href` (e.g. `role="button"` shells)
 */

export type Pending =
  | { kind: "click"; href: string }
  | { kind: "popstate"; href: string }
  | null

export type NavigationGuard = {
  pending: Pending
  confirm: () => void
  cancel: () => void
}

export function useNavigationGuard(
  when: boolean,
  message: string = "You have unsaved changes. Leave anyway?"
): NavigationGuard {
  const router = useRouter()
  const [pending, setPending] = useState<Pending>(null)
  // Captured once per arm so popstate can know which URL to restore to.
  const anchorUrl = useRef<string>("")
  // Set true immediately before our own programmatic navigation that
  // came from a popstate confirm; the popstate listener will skip its
  // restore-and-reblock branch on the next firing.
  const bypassPopstate = useRef(false)

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

      // Same-origin in-app navigation: intercept and surface dialog.
      e.preventDefault()
      e.stopPropagation()
      setPending({
        kind: "click",
        href: anchor.pathname + anchor.search + anchor.hash
      })
    }

    // Capture the anchor URL — the page we're guarding. We restore to
    // this URL whenever a popstate moves us off it.
    //
    // We deliberately do NOT push a sentinel history entry on mount.
    // The sentinel approach (push a duplicate of the current URL so the
    // first back press lands on a "safe" copy) sounds safer in theory
    // but in practice traps the user: every back press lands on the same
    // pathname, hits the "same path → re-push silently" branch below,
    // and the dialog never fires. Without the sentinel, the first back
    // press lands on a different page, falls through to the "different
    // path → restore + dialog" branch, and the user actually sees the
    // confirm. Fresh-tab edge case (history.length === 1) is already
    // covered by beforeunload — popstate doesn't fire when there's
    // nowhere to go back to.
    anchorUrl.current = window.location.href

    const onPopState = () => {
      if (bypassPopstate.current) {
        bypassPopstate.current = false
        // we initiated this; let it proceed
        return
      }

      // Hash/search-only changes within the SAME pathname: don't block.
      // (e.g., a future page using ?tab=foo for tab state, or a back
      // press through a multi-step in-page wizard.) Today no editor URL
      // uses query state semantically, so this branch rarely fires —
      // it's defensive for future routes.
      const anchorPath = new URL(anchorUrl.current).pathname
      if (window.location.pathname === anchorPath) {
        window.history.pushState({ navGuard: true }, "", anchorUrl.current)
        return
      }

      // Different pathname — capture destination, restore URL via push,
      // open dialog. The browser has already committed the popstate by
      // the time we get here, so we push to undo the URL change visually.
      const destination = window.location.href
      window.history.pushState({ navGuard: true }, "", anchorUrl.current)
      setPending({ kind: "popstate", href: destination })
    }

    window.addEventListener("beforeunload", beforeUnload)
    // Capture phase is non-negotiable — Next.js's <Link> registers its
    // own click handler that intercepts before any document-level
    // bubble-phase listener can run.
    document.addEventListener("click", onClick, true)
    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("popstate", onPopState)
    }
    // `router` is stable across renders in Next.js 13+ App Router —
    // including it in deps would cause unnecessary listener teardown +
    // re-registration on every parent re-render (PageForm re-renders
    // on every keystroke under RHF default mode).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, message])

  const confirm = () => {
    if (!pending) return
    if (pending.kind === "popstate") {
      bypassPopstate.current = true
      // Forward-navigate to the destination URL the user originally
      // tried to reach. router.push is direction-agnostic — no need to
      // count back/forward steps.
      const u = new URL(pending.href)
      router.push(u.pathname + u.search + u.hash)
    } else if (pending.kind === "click") {
      router.push(pending.href)
    }
    setPending(null)
  }

  const cancel = () => {
    // For popstate the URL is already restored by the listener's
    // pushState; for click we never navigated. Either way, just clear
    // the pending state.
    setPending(null)
  }

  return { pending, confirm, cancel }
}

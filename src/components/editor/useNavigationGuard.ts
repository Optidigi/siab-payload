"use client"
import { useEffect } from "react"

/**
 * Block accidental navigation while a form has unsaved work.
 *
 * Pass `when={true}` whenever the user has dirty state (or a save is
 * in flight). The hook installs a `beforeunload` listener that triggers
 * the browser's native "Leave site?" prompt.
 *
 * Catches:
 *  - tab/window close
 *  - F5 / hard refresh
 *  - typing a new URL into the address bar
 *  - browser back/forward to an off-site origin
 *
 * Does NOT catch (yet):
 *  - in-app `<Link>` / `<a>` clicks within the SPA — Next.js's client
 *    router intercepts those before `beforeunload` fires. A follow-up
 *    commit adds an SPA-level click guard to this same hook.
 *
 * The `message` argument is mostly cosmetic — modern browsers ignore
 * the custom string and show their own copy. We still set
 * `e.returnValue` because that's what actually triggers the prompt.
 */
export function useNavigationGuard(
  when: boolean,
  message: string = "You have unsaved changes. Leave anyway?"
): void {
  useEffect(() => {
    if (!when) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // returnValue is the load-bearing piece; the string is ignored by
      // most browsers but some legacy ones still surface it.
      e.returnValue = message
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [when, message])
}

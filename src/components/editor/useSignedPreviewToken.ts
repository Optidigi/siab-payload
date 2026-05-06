"use client"
import { useEffect, useRef, useState } from "react"

type State =
  | { status: "loading" }
  | { status: "ready"; token: string; exp: number }
  | { status: "error"; message: string }

/**
 * Mints a preview HMAC token from POST /api/preview-tokens, refreshes
 * before exp via setTimeout, AND on visibilitychange/focus to handle
 * background-tab setTimeout throttling.
 *
 * Returns the latest token + exp; consumers embed `?t=${token}` in the
 * iframe URL and call `forceRefresh()` on hard error.
 */
export function useSignedPreviewToken({
  tenantId,
  pageId,
}: {
  tenantId: number | string
  pageId: number | string
}) {
  const [state, setState] = useState<State>({ status: "loading" })
  const tokenRef = useRef<{ token: string; exp: number } | null>(null)

  const mint = async () => {
    try {
      const res = await fetch("/api/preview-tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, pageId }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        const msg =
          res.status === 403
            ? "You don't have access to this tenant's preview."
            : detail.message ?? `mint failed: HTTP ${res.status}`
        throw new Error(msg)
      }
      const json = (await res.json()) as { token: string; exp: number }
      tokenRef.current = json
      setState({ status: "ready", token: json.token, exp: json.exp })
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Token mint failed",
      })
    }
  }

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    const scheduleRefresh = () => {
      const tok = tokenRef.current
      if (!tok) return
      const refreshAt = tok.exp - 60
      const delayMs = Math.max(0, (refreshAt - Math.floor(Date.now() / 1000)) * 1000)
      timer = window.setTimeout(() => {
        if (cancelled) return
        mint().then(() => !cancelled && scheduleRefresh())
      }, delayMs)
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      const tok = tokenRef.current
      if (!tok) return
      const remaining = tok.exp - Math.floor(Date.now() / 1000)
      if (remaining < 60) {
        mint().then(() => !cancelled && scheduleRefresh())
      }
    }

    mint().then(() => {
      if (!cancelled) scheduleRefresh()
    })

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, pageId])

  return {
    state,
    forceRefresh: mint,
  }
}

"use client"
import { useEffect, useRef, useState } from "react"
import { useWatch, type Control } from "react-hook-form"
import { useSignedPreviewToken } from "./useSignedPreviewToken"
import { PreviewToolbar, type ViewportMode, type PreviewStatus } from "./PreviewToolbar"
import type { PreviewMode } from "./SaveStatusBar"

type Props = {
  control: Control<any>
  tenantId: number | string
  tenantOrigin: string  // e.g. "https://amicare.example.com"
  pageId: number | string
  previewMode: PreviewMode
  setPreviewMode: (m: PreviewMode) => void
}

const DEBOUNCE_MS = 100
const HEARTBEAT_TIMEOUT_MS = 60_000

export function PreviewPane({ control, tenantId, tenantOrigin, pageId, previewMode, setPreviewMode }: Props) {
  const { state: tokenState, forceRefresh } = useSignedPreviewToken({ tenantId, pageId })
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<PreviewStatus>("loading")
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [viewport, setViewport] = useState<ViewportMode>("full")
  const [isSlowLoad, setIsSlowLoad] = useState(false)
  const [iframeLoadedAt, setIframeLoadedAt] = useState<number | null>(null)
  const lastHeartbeatRef = useRef<number>(0)

  // Parse tenantOrigin once; bail out with a clear error UI if malformed.
  let parsedTenantOrigin: string | null = null
  try {
    parsedTenantOrigin = new URL(tenantOrigin).origin
  } catch {
    parsedTenantOrigin = null
  }

  // Sandbox-attr safety invariant: admin origin (where this component
  // runs) MUST differ from tenant origin. Otherwise allow-scripts +
  // allow-same-origin would let the iframe script-modify the embedder.
  const isInvalidOrigin =
    typeof window !== "undefined" &&
    parsedTenantOrigin !== null &&
    parsedTenantOrigin === window.location.origin

  // Subscribe to all form values from inside this component (NOT PageForm).
  // useWatch keeps re-renders local; PageForm and BlockEditor stay quiet.
  const draftValues = useWatch({ control })

  // postMessage listener for handshake / heartbeat / errors from iframe
  useEffect(() => {
    if (parsedTenantOrigin == null) return
    const expected = parsedTenantOrigin
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== expected) return
      const data = e.data as { type?: string; version?: number; message?: string } | null
      if (!data || typeof data !== "object") return
      if (data.type === "preview:ready" && data.version === 1) {
        setStatus("ready")
        setErrorMessage(undefined)
        lastHeartbeatRef.current = Date.now()
      } else if (data.type === "preview:heartbeat" && data.version === 1) {
        lastHeartbeatRef.current = Date.now()
      } else if (data.type === "preview:error" && data.version === 1) {
        // Per-block errors don't take the whole preview red; log only.
        // eslint-disable-next-line no-console
        console.warn("[preview] block render error:", data.message)
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [parsedTenantOrigin])

  // Watchdog: if no heartbeat for 60s after ready, mark reconnecting.
  useEffect(() => {
    if (status !== "ready") return
    const t = window.setInterval(() => {
      if (Date.now() - lastHeartbeatRef.current > HEARTBEAT_TIMEOUT_MS) {
        setStatus("reconnecting")
      }
    }, 5_000)
    return () => clearInterval(t)
  }, [status])

  // Watchdog: if iframe fired `load` but no preview:ready arrived within
  // 10s, surface a clear error so the user can hit the toolbar's Refresh.
  useEffect(() => {
    if (iframeLoadedAt == null || status === "ready") return
    const t = window.setTimeout(() => {
      // Re-check via state setter form to avoid stale closure: only flip
      // to error if we're still not ready when the timer fires.
      setStatus((s) => {
        if (s === "ready") return s
        setErrorMessage(
          "Iframe loaded but preview did not initialize. Check tenant origin and PUBLIC_ADMIN_ORIGIN env on the tenant.",
        )
        return "error"
      })
    }, 10_000)
    return () => clearTimeout(t)
  }, [iframeLoadedAt, status])

  // Slow-load copy: after 5s in loading state, swap in a more diagnostic message.
  useEffect(() => {
    if (tokenState.status !== "loading" && status !== "loading") return
    const t = window.setTimeout(() => setIsSlowLoad(true), 5000)
    return () => clearTimeout(t)
  }, [tokenState.status, status])

  // Debounced postMessage on draft change
  useEffect(() => {
    if (status !== "ready") return
    if (parsedTenantOrigin == null) return
    const win = iframeRef.current?.contentWindow
    if (!win) return
    const t = window.setTimeout(() => {
      const payload = { page: draftValues }
      win.postMessage(
        { type: "preview:draft", version: 1, payload },
        parsedTenantOrigin,
      )
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [draftValues, status, parsedTenantOrigin])

  // Token lifecycle → status
  useEffect(() => {
    if (tokenState.status === "loading") setStatus("loading")
    else if (tokenState.status === "error") {
      setStatus("error")
      setErrorMessage(tokenState.message)
    }
    // ready is set by preview:ready postMessage, not by token state
  }, [tokenState])

  // Build the body based on state. The toolbar wraps EVERY body so escape
  // controls (mode toggle, hide) are always reachable — even from error
  // states. Without this, an operator who hits "Server misconfigured" or
  // "Invalid tenant origin" while in fullscreen mode has no way out short
  // of clearing localStorage. Earlier versions early-returned each error
  // case before the toolbar mounted; that was the bug operators hit.
  const widths: Record<ViewportMode, string> = { mobile: "375px", laptop: "1024px", full: "100%" }
  const previewUrl =
    tokenState.status === "ready" && parsedTenantOrigin != null
      ? `${parsedTenantOrigin}/__preview?t=${encodeURIComponent(tokenState.token)}`
      : null

  let body: React.ReactNode
  if (parsedTenantOrigin == null) {
    body = (
      <div className="m-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Preview disabled: invalid tenant origin (<code>{tenantOrigin}</code>).
      </div>
    )
  } else if (isInvalidOrigin) {
    body = (
      <div className="m-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Preview disabled: tenant origin must differ from admin origin (sandbox-attr safety invariant).
      </div>
    )
  } else if (tokenState.status === "loading") {
    body = (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground p-4 text-center">
        {isSlowLoad
          ? "Still loading… check the tenant origin and HMAC secret if this persists."
          : "Loading preview…"}
      </div>
    )
  } else if (tokenState.status === "error") {
    body = (
      <div className="m-4 space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">Preview error: {tokenState.message}</p>
        <button type="button" className="text-sm underline" onClick={() => forceRefresh()}>
          Retry
        </button>
      </div>
    )
  } else {
    body = (
      <div className="flex-1 overflow-auto bg-muted/30">
        <div
          className="mx-auto h-full transition-[width] duration-200"
          style={{ width: widths[viewport] }}
        >
          <iframe
            key={tokenState.token} // remount on token rotation so manual refresh definitely reloads
            ref={iframeRef}
            src={previewUrl ?? ""}
            sandbox="allow-scripts allow-same-origin allow-forms"
            className="h-full w-full border-0 bg-background"
            title="Page preview"
            onLoad={() => setIframeLoadedAt(Date.now())}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PreviewToolbar
        status={status}
        errorMessage={errorMessage}
        viewport={viewport}
        setViewport={setViewport}
        onRefresh={() => {
          forceRefresh()
          if (iframeRef.current && previewUrl) iframeRef.current.src = previewUrl
        }}
        onOpenInNewTab={() => {
          if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer")
        }}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
      />
      {body}
    </div>
  )
}

"use client"
import { useEffect, useRef, useState } from "react"
import { useWatch, type Control } from "react-hook-form"
import { useSignedPreviewToken } from "./useSignedPreviewToken"
import { PreviewToolbar, type ViewportMode, type PreviewStatus } from "./PreviewToolbar"

type Props = {
  control: Control<any>
  tenantId: number | string
  tenantOrigin: string  // e.g. "https://amicare.example.com"
  pageId: number | string
}

const DEBOUNCE_MS = 100
const HEARTBEAT_TIMEOUT_MS = 60_000

export function PreviewPane({ control, tenantId, tenantOrigin, pageId }: Props) {
  const { state: tokenState, forceRefresh } = useSignedPreviewToken({ tenantId, pageId })
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<PreviewStatus>("loading")
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [viewport, setViewport] = useState<ViewportMode>("full")
  const lastHeartbeatRef = useRef<number>(0)

  // Sandbox-attr safety invariant: admin origin (where this component
  // runs) MUST differ from tenant origin. Otherwise allow-scripts +
  // allow-same-origin would let the iframe script-modify the embedder.
  const isInvalidOrigin =
    typeof window !== "undefined" && new URL(tenantOrigin).origin === window.location.origin

  // Subscribe to all form values from inside this component (NOT PageForm).
  // useWatch keeps re-renders local; PageForm and BlockEditor stay quiet.
  const draftValues = useWatch({ control })

  // postMessage listener for handshake / heartbeat / errors from iframe
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const expected = new URL(tenantOrigin).origin
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
  }, [tenantOrigin])

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

  // Debounced postMessage on draft change
  useEffect(() => {
    if (status !== "ready") return
    const win = iframeRef.current?.contentWindow
    if (!win) return
    const t = window.setTimeout(() => {
      const payload = { page: draftValues }
      win.postMessage(
        { type: "preview:draft", version: 1, payload },
        new URL(tenantOrigin).origin,
      )
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [draftValues, status, tenantOrigin])

  // Token lifecycle → status
  useEffect(() => {
    if (tokenState.status === "loading") setStatus("loading")
    else if (tokenState.status === "error") {
      setStatus("error")
      setErrorMessage(tokenState.message)
    }
    // ready is set by preview:ready postMessage, not by token state
  }, [tokenState])

  if (isInvalidOrigin) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Preview disabled: tenant origin must differ from admin origin (sandbox-attr safety invariant).
      </div>
    )
  }

  if (tokenState.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading preview…
      </div>
    )
  }

  if (tokenState.status === "error") {
    return (
      <div className="space-y-2 p-4">
        <p className="text-sm text-destructive">Preview error: {tokenState.message}</p>
        <button type="button" className="text-sm underline" onClick={() => forceRefresh()}>
          Retry
        </button>
      </div>
    )
  }

  const { token } = tokenState
  const previewUrl = `${tenantOrigin}/__preview?t=${encodeURIComponent(token)}`
  const widths: Record<ViewportMode, string> = { mobile: "375px", laptop: "1024px", full: "100%" }

  return (
    <div className="flex h-full flex-col">
      <PreviewToolbar
        status={status}
        errorMessage={errorMessage}
        viewport={viewport}
        setViewport={setViewport}
        onRefresh={() => {
          forceRefresh()
          if (iframeRef.current) iframeRef.current.src = previewUrl
        }}
        onOpenInNewTab={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
      />
      <div className="flex-1 overflow-auto bg-muted/30">
        <div
          className="mx-auto h-full transition-[width] duration-200"
          style={{ width: widths[viewport] }}
        >
          <iframe
            ref={iframeRef}
            src={previewUrl}
            sandbox="allow-scripts allow-same-origin allow-forms"
            className="h-full w-full border-0 bg-background"
            title="Page preview"
          />
        </div>
      </div>
    </div>
  )
}

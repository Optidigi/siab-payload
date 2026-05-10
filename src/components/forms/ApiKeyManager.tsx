"use client"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Copy, Key } from "lucide-react"
import { toast } from "sonner"
import { parsePayloadError } from "@/lib/api"
import type { User } from "@/payload-types"

export function ApiKeyManager({ user }: { user: User }) {
  const [pending, setPending] = useState(false)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const enabled = user.enableAPIKey ?? false

  const generate = async (alsoEnable: boolean) => {
    setPending(true)
    const newKey = crypto.randomUUID()
    const body: Record<string, unknown> = { apiKey: newKey }
    if (alsoEnable) body.enableAPIKey = true
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
    setPending(false)
    if (!res.ok) {
      // FN-2026-0054 — parsed Payload error message instead of raw text slice
      const detail = await parsePayloadError(res)
      toast.error(`Generate failed: ${detail.message}`)
      return
    }
    // FN-2026-0001/0002 fix — surface the generated key IMMEDIATELY before
    // any further server interaction. The previous shape called
    // `router.refresh()` here, which re-fetched the /api-key server
    // component; Payload's apiKey rotation can invalidate the active
    // session JWT, so the refresh would redirect to /login mid-flight
    // and the revealedKey state was lost — the user never saw the key
    // they were supposed to copy. Now: we render the key-reveal card and
    // wait for the user to dismiss; the dismiss handler then does a full
    // `window.location.reload()` which re-validates auth cleanly (lands
    // on /login if the session is gone, otherwise re-renders /api-key
    // with the new enabled state).
    setRevealedKey(newKey)
  }

  const disable = async () => {
    setPending(true)
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enableAPIKey: false, apiKey: null })
    })
    setPending(false)
    if (!res.ok) {
      // FN-2026-0054 — parsed Payload error message instead of raw text slice
      const detail = await parsePayloadError(res)
      const msg = `Disable failed: ${detail.message}`
      toast.error(msg)
      throw new Error(msg)
    }
    toast.success("API key disabled")
    // FN-2026-0003 fix — same reasoning as generate(): a hard reload
    // re-validates auth state from scratch. If Payload invalidated the
    // session JWT during this PATCH, the requireAuth() server check
    // redirects to /login; otherwise we get a clean /api-key page with
    // the disabled-state card.
    window.location.reload()
  }

  const dismiss = () => {
    setRevealedKey(null)
    // Re-validate auth after the user has copied the key. See generate()
    // for why router.refresh() is unsafe here.
    window.location.reload()
  }

  if (revealedKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>New API key</CardTitle>
          <CardDescription>Copy now — the admin API will not return this key again. Store it in a password manager or secrets vault.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border bg-muted p-3">
            <Key className="h-4 w-4 shrink-0 text-muted-foreground"/>
            <code className="text-xs flex-1 break-all">{revealedKey}</code>
            <Button size="sm" variant="outline" type="button"
              onClick={() => { navigator.clipboard.writeText(revealedKey); toast.success("Copied") }}>
              <Copy className="h-3 w-3"/>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use as: <code>Authorization: users API-Key {revealedKey.slice(0, 8)}...</code>
          </p>
          <Button onClick={dismiss}>Done</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API key</CardTitle>
        <CardDescription>
          API keys let machine clients (e.g. the orchestrator) authenticate as you. Keys are encrypted at rest and the admin API refuses to return them on read — copy each new key the moment it&apos;s generated, since you can&apos;t retrieve it later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="flex flex-col">
            <span className="font-medium">API key {enabled ? "enabled" : "disabled"}</span>
            <span className="text-xs text-muted-foreground">
              {enabled
                ? "An API key is active for this account."
                : "No active API key. Generate one to enable machine access."}
            </span>
          </div>
          {/* WCAG 4.1.2 — the visible "API key enabled/disabled" copy beside
              the Switch carries state, but the trigger itself needs a stable
              accessible name (current/desired state is conveyed via
              aria-checked, not via the name). */}
          <Switch
            aria-label="API key"
            checked={enabled}
            disabled={pending}
            onCheckedChange={(v) => v ? generate(true) : setConfirmOpen(true)}
          />
        </div>

        {enabled && (
          <Button variant="outline" onClick={() => generate(false)} disabled={pending}>
            <Key className="mr-2 h-4 w-4"/> Regenerate (rotate)
          </Button>
        )}

        {enabled && (
          <p className="text-xs text-muted-foreground">
            Rotating immediately invalidates the previous key. Update any external integrations afterward. You may need to sign in again after rotating — the new key is shown one-time before that happens.
          </p>
        )}
        {!enabled && (
          <p className="text-xs text-muted-foreground">
            Enabling generates a key that&apos;s shown ONCE on the next screen — copy it before continuing. You may need to sign in again afterward.
          </p>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disable API key?"
        description={
          <>
            This stops the key from authenticating new requests. Any integrations
            currently using it will start receiving 401 errors immediately.
            You can issue a new key afterward.
          </>
        }
        confirmLabel="Disable key"
        variant="destructive"
        onConfirm={disable}
      />
    </Card>
  )
}

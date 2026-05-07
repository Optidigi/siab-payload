"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Copy, Key } from "lucide-react"
import { toast } from "sonner"
import type { User } from "@/payload-types"

export function ApiKeyManager({ user }: { user: User }) {
  const router = useRouter()
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
      const txt = await res.text()
      toast.error("Failed: " + txt.slice(0, 100))
      return
    }
    setRevealedKey(newKey)
    router.refresh()
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
      const txt = await res.text()
      const msg = "Failed: " + txt.slice(0, 100)
      toast.error(msg)
      throw new Error(msg)
    }
    toast.success("API key disabled")
    router.refresh()
  }

  const dismiss = () => setRevealedKey(null)

  if (revealedKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>New API key</CardTitle>
          <CardDescription>Copy now — it won&apos;t be shown again. Store it in a password manager or secrets vault.</CardDescription>
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
          API keys let machine clients (e.g. the orchestrator) authenticate as you. Keys are write-once: Payload stores only a hash, so you&apos;ll need to copy each new key the moment it&apos;s generated.
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
          <Switch checked={enabled} disabled={pending} onCheckedChange={(v) => v ? generate(true) : setConfirmOpen(true)} />
        </div>

        {enabled && (
          <Button variant="outline" onClick={() => generate(false)} disabled={pending}>
            <Key className="mr-2 h-4 w-4"/> Regenerate (rotate)
          </Button>
        )}

        {enabled && (
          <p className="text-xs text-muted-foreground">
            Rotating immediately invalidates the previous key. Update any external integrations afterward.
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

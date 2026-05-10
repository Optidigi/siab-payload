"use client"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

type Step = { id: string; title: string; description: React.ReactNode; copy?: string }

// FN-2026-0008 — persist checklist state in localStorage so the multi-day,
// multi-system onboarding work survives reloads. Per-browser, per-tenant.
// Cross-device persistence (e.g. operator switches machines) would require
// a backing store on Tenant; that's the appropriate next step but out of
// scope for this incremental fix.
const lsKey = (tenantId: number | string) => `siab.onboarding.${tenantId}`

const SEED: Record<string, boolean> = { "tenant-record": true }

export function OnboardingChecklist({
  tenant, vpsIp
}: { tenant: { domain: string; slug: string; id: number | string }; vpsIp: string }) {
  // Initial state ALWAYS uses SEED — localStorage is unavailable during the
  // SSR pass and the first client render must match the server output to
  // avoid a hydration mismatch warning. The useEffect below merges in the
  // persisted state immediately after mount.
  const [done, setDone] = useState<Record<string, boolean>>(SEED)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(lsKey(tenant.id))
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object") {
        // SEED's "tenant-record": true is non-overridable — that step is
        // implicitly done by virtue of the tenant existing. Other steps
        // come from the persisted shape.
        setDone({ ...SEED, ...parsed })
      }
    } catch {
      // Quota / corrupt JSON — ignore; user keeps the seed.
    }
  }, [tenant.id])
  const toggle = (id: string) =>
    setDone((d) => {
      const next = { ...d, [id]: !d[id] }
      try {
        window.localStorage.setItem(lsKey(tenant.id), JSON.stringify(next))
      } catch {
        // Quota exceeded — toggle stays in memory; no toast (low value).
      }
      return next
    })

  const npmConfig = JSON.stringify({
    domain_names: [`admin.${tenant.domain}`],
    forward_host: "siab-payload",
    forward_port: 3000,
    block_exploits: true,
    websockets: true,
    ssl_forced: true,
    http2_support: true
  }, null, 2)

  const steps: Step[] = [
    { id: "tenant-record", title: "Tenant record created",
      description: <span>Done. <code>id: {String(tenant.id)}</code></span> },
    { id: "dns", title: "Add DNS A record",
      description: <span>At client's registrar: <code>admin.{tenant.domain}</code> → <code>{vpsIp}</code></span>,
      copy: vpsIp },
    { id: "npm", title: "Configure NPM proxy host",
      description: <span>In nginx-proxy-manager: <code>admin.{tenant.domain}</code> → <code>siab-payload:3000</code> · WebSockets: on</span>,
      copy: npmConfig },
    { id: "cert", title: "Issue Let's Encrypt cert",
      description: <span>In NPM: SSL → Force SSL → Request New Certificate</span> },
    { id: "owner", title: "Create owner user + send invite",
      description: <span><a href={`/sites/${tenant.slug}/users`} className="underline">Open users page</a></span> },
    { id: "verify", title: "Verify access",
      description: (
        <span>
          <a href={`https://admin.${tenant.domain}`} className="underline" target="_blank" rel="noopener noreferrer">
            https://admin.{tenant.domain}
          </a>
        </span>
      ) }
  ]

  return (
    <div className="space-y-3">
      {steps.map((s) => (
        <Card key={s.id}>
          <CardContent className="p-4 flex items-start gap-3">
            <button
              type="button"
              onClick={() => toggle(s.id)}
              className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center ${done[s.id] ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-500" : "border-muted-foreground"}`}
              aria-label={done[s.id] ? "Mark incomplete" : "Mark done"}
            >
              {done[s.id] && <Check className="h-3 w-3" />}
            </button>
            <div className="flex-1">
              <div className="font-medium">{s.title}</div>
              <div className="text-sm text-muted-foreground">{s.description}</div>
            </div>
            {s.copy && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { navigator.clipboard.writeText(s.copy!); toast.success("Copied") }}
              >
                <Copy className="mr-1 h-3 w-3" /> Copy
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

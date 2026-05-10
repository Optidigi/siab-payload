import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

type Stat = {
  label: string
  value: number | string
  delta?: string
  deltaTone?: "up" | "down"
  icon?: LucideIcon
  // FN-2026-0045 — optional href so the dashboard caller can opt cards
  // into linking to a relevant subroute. Cards without an href stay
  // non-interactive (some metrics genuinely have no drill-down target).
  href?: string
}

function StatCardInner({ s }: { s: Stat }) {
  const Icon = s.icon
  return (
    <>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2 p-4">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />}
        <CardDescription>{s.label}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <CardTitle className="text-xl sm:text-2xl">{s.value}</CardTitle>
        {s.delta && (
          <div className={`text-xs mt-1 ${s.deltaTone === "down" ? "text-destructive" : "text-emerald-500"}`}>
            {s.delta}
          </div>
        )}
      </CardContent>
    </>
  )
}

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {stats.map((s) =>
        s.href ? (
          <Link key={s.label} href={s.href} className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="cursor-pointer transition-shadow hover:shadow-md hover:border-foreground/20">
              <StatCardInner s={s} />
            </Card>
          </Link>
        ) : (
          <Card key={s.label}>
            <StatCardInner s={s} />
          </Card>
        )
      )}
    </div>
  )
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

type Stat = {
  label: string
  value: number | string
  delta?: string
  deltaTone?: "up" | "down"
  icon?: LucideIcon
}

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon
        return (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardDescription>{s.label}</CardDescription>
              {Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />}
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <CardTitle className="text-xl sm:text-2xl">{s.value}</CardTitle>
              {s.delta && (
                <div className={`text-xs mt-1 ${s.deltaTone === "down" ? "text-destructive" : "text-emerald-500"}`}>
                  {s.delta}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

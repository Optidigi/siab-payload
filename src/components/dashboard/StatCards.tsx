import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"

type Stat = { label: string; value: number | string; delta?: string; deltaTone?: "up" | "down" }

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="p-4">
            <CardDescription>{s.label}</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">{s.value}</CardTitle>
            {s.delta && (
              <div className={`text-xs mt-1 ${s.deltaTone === "down" ? "text-destructive" : "text-emerald-500"}`}>
                {s.delta}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

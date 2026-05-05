"use client"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const chartConfig: ChartConfig = {
  count: { label: "Edits", color: "var(--chart-1)" }
}

export function EditsChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Edits per day · last 30 days</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="fillEdits" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.55} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey="count" stroke="var(--chart-1)" fill="url(#fillEdits)" strokeWidth={1.5} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

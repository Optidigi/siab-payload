import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusPill } from "@/components/shared/StatusPill"
import { relativeTime } from "@/lib/relativeTime"
import type { ActivityEntry } from "@/lib/activity"

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>What</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={`${e.type}:${e.id}`}>
                <TableCell className="text-muted-foreground">{relativeTime(e.updatedAt)}</TableCell>
                <TableCell>{e.tenantName ?? e.tenantId.slice(0, 8)}</TableCell>
                <TableCell>{e.type === "page" ? `Updated ${e.title}` : e.title}</TableCell>
                <TableCell className="text-muted-foreground">{e.updatedBy ?? "—"}</TableCell>
                <TableCell><StatusPill status={e.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

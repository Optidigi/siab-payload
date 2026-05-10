import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusPill } from "@/components/shared/StatusPill"
import { relativeTime } from "@/lib/relativeTime"
import type { ActivityEntry } from "@/lib/activity"

// FN-2026-0046 — derive a drill-down href from the activity entry where
// possible. Pages route to /sites/<slug>/pages/<id>; forms route to the
// tenant's forms list. Returns null when we can't construct a target.
function entryHref(e: ActivityEntry): string | null {
  if (!e.tenantSlug) return null
  if (e.type === "page") return `/sites/${e.tenantSlug}/pages/${e.id}`
  if (e.type === "form") return `/sites/${e.tenantSlug}/forms`
  if (e.type === "media") return `/sites/${e.tenantSlug}/media`
  if (e.type === "settings") return `/sites/${e.tenantSlug}/settings`
  return null
}

/**
 * UX-2026-0002 / GitHub issue #15 — Recent activity feed responsively
 * branches between a desktop Table and a mobile flat-list. The mobile
 * branch is a `divide-y` list of plain `<div>`s (NOT nested Cards —
 * batch-5's UX-2026-0029 fix demonstrates the flex-col-baked-in pitfall
 * with Card primitives in row layouts). Each mobile row shows
 *   - title row: "<what>" on left + StatusPill on right
 *   - meta row: "<who> · <when>" small + muted
 *   - tenant name surfaced inline when present (super-admin views)
 * The desktop Table preserves the existing 5-column shape.
 */
export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
      <CardContent className="p-0">
        {/* Desktop: 5-column table with the existing column-padding tweak
            so When sits under the title and Status ends at the same right
            edge as the card title row. */}
        <div className="hidden md:block">
          <Table className="[&_thead_th:first-child]:pl-6 [&_thead_th:last-child]:pr-6 [&_tbody_td:first-child]:pl-6 [&_tbody_td:last-child]:pr-6">
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
              {entries.map((e) => {
                const href = entryHref(e)
                return (
                  <TableRow
                    key={`${e.type}:${e.id}`}
                    className={href ? "cursor-pointer hover:bg-muted/50 group" : undefined}
                  >
                    <TableCell className="text-muted-foreground">{relativeTime(e.updatedAt)}</TableCell>
                    <TableCell>{e.tenantName ?? e.tenantId.slice(0, 8)}</TableCell>
                    <TableCell>
                      {/* FN-2026-0046 — when a drill-down target exists,
                          wrap the most identifying cell ("What") in a Link
                          so the row becomes navigable while preserving the
                          existing 5-column shape. Tailwind group: lets the
                          row's hover affect the link's underline. */}
                      {href ? (
                        <Link href={href} className="hover:underline group-hover:underline">
                          {e.type === "page" ? `Updated ${e.title}` : e.title}
                        </Link>
                      ) : (
                        <>{e.type === "page" ? `Updated ${e.title}` : e.title}</>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.updatedBy ?? "—"}</TableCell>
                    <TableCell><StatusPill status={e.status} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {/* Mobile: flat divide-y list. Each row is a plain <div> with
            title + StatusPill on top, who · when on bottom (muted). */}
        <ul className="md:hidden divide-y border-t">
          {entries.map((e) => {
            const what = e.type === "page" ? `Updated ${e.title}` : e.title
            const who = e.updatedBy ?? "—"
            const when = relativeTime(e.updatedAt)
            const href = entryHref(e)
            // FN-2026-0046 — wrap the entire mobile row in a Link when a
            // target exists. Use <Link> as the rendered <li>'s child so
            // the entire tap target is a single anchor (avoids nested
            // anchor pitfalls; the row contains no other <a>).
            const inner = (
              <>
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <span className="font-medium truncate min-w-0">{what}</span>
                  <StatusPill status={e.status} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                  <span className="truncate min-w-0">{who}</span>
                  <span aria-hidden>·</span>
                  <span className="shrink-0">{when}</span>
                  {e.tenantName && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="truncate min-w-0">{e.tenantName}</span>
                    </>
                  )}
                </div>
              </>
            )
            return (
              <li key={`${e.type}:${e.id}`} data-slot="activity-row">
                {href ? (
                  <Link href={href} className="flex flex-col gap-1 px-4 py-3 active:bg-muted/50 hover:bg-muted/30 transition-colors">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex flex-col gap-1 px-4 py-3">{inner}</div>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

"use client"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { MediaPageRef } from "@/lib/queries/mediaUsageWalker"

/**
 * Read-only "Used in" listing for a single media item. Operators reach
 * this from the badge on each MediaGrid card. The dialog is purely
 * informational; deletion goes through TypedConfirmDialog separately.
 *
 * `pagesBaseHref` is the editor route prefix for this tenant context —
 * tenant-host pages use "/pages", super-admin in /sites/<slug>/pages
 * uses that. Caller passes whichever applies.
 */
export function MediaUsageDialog({
  open,
  onOpenChange,
  filename,
  pages,
  settings,
  pagesBaseHref
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  filename: string
  pages: MediaPageRef[]
  settings: boolean
  pagesBaseHref: string
}) {
  const total = pages.length + (settings ? 1 : 0)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Used in {total === 1 ? "1 place" : `${total} places`}</DialogTitle>
          <DialogDescription>
            Pages and settings that reference <strong>{filename}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 text-sm">
          {pages.map((p) => (
            <Link
              key={String(p.id)}
              href={`${pagesBaseHref}/${p.id}`}
              className="block rounded px-2 py-1 hover:bg-accent"
              onClick={() => onOpenChange(false)}
              aria-label={`Open page ${p.title}`}
            >
              <span className="font-medium">{p.title}</span>
              {p.slug && <span className="text-muted-foreground"> /{p.slug}</span>}
            </Link>
          ))}
          {settings && (
            <div className="rounded px-2 py-1 text-muted-foreground">
              Site settings — branding logo
            </div>
          )}
          {total === 0 && (
            <div className="rounded px-2 py-1 text-muted-foreground">Not referenced anywhere.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

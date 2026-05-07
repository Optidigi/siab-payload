import { Badge } from "@/components/ui/badge"

export function StatusPill({ status }: { status?: string }) {
  if (!status) return null
  // WCAG AA: deeper -700 text on -50 bg for light mode (≥4.5:1),
  // lighter -300 text on -500/15 bg for dark mode. A leading dot
  // (bg-current) provides a redundant non-color cue for accessibility.
  const tone: Record<string, string> = {
    published:    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20",
    draft:        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20",
    new:          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/20",
    contacted:    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/20",
    spam:         "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/20",
    suspended:    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-600/15 dark:text-amber-300 dark:border-amber-600/20",
    archived:     "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-300 dark:border-zinc-500/20",
    active:       "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20",
    provisioning: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/20",
  }
  return (
    <Badge variant="outline" className={tone[status] ?? ""}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {status}
    </Badge>
  )
}

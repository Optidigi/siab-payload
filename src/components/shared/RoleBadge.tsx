import { Badge } from "@/components/ui/badge"

// WCAG 1.4.3 (Contrast Minimum, AA) — text-*-500 on bg-*-500/15-over-card
// composites to ~3:1 on light-mode cards and fails the 4.5:1 floor for normal
// text. Per-mode overrides: 700-shade text on light cards (darker, AA-passing
// against the lightly-tinted bg) and 300-shade text on dark cards (lighter,
// AA-passing against the dark-tinted bg). Pattern verified for all four
// tones via axe-core 4.10.2 in both themes.
const TONE: Record<string, string> = {
  "super-admin": "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "owner":       "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "editor":      "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "viewer":      "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300"
}

export function RoleBadge({ role }: { role: string }) {
  return <Badge variant="outline" className={TONE[role] ?? ""}>{role}</Badge>
}

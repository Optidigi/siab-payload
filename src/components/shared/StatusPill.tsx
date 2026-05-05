import { Badge } from "@/components/ui/badge"

export function StatusPill({ status }: { status?: string }) {
  if (!status) return null
  const tone: Record<string, string> = {
    published: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
    draft: "bg-amber-500/15 text-amber-500 border-amber-500/20",
    new: "bg-blue-500/15 text-blue-500 border-blue-500/20",
    contacted: "bg-purple-500/15 text-purple-500 border-purple-500/20",
    spam: "bg-rose-500/15 text-rose-500 border-rose-500/20",
    suspended: "bg-amber-600/15 text-amber-600 border-amber-600/20",
    archived: "bg-zinc-500/15 text-zinc-500 border-zinc-500/20",
    active: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
    provisioning: "bg-blue-500/15 text-blue-500 border-blue-500/20"
  }
  return <Badge variant="outline" className={tone[status] ?? ""}>{status}</Badge>
}

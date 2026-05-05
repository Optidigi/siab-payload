import { Badge } from "@/components/ui/badge"

export function RoleBadge({ role }: { role: string }) {
  const tone: Record<string, string> = {
    "super-admin": "bg-purple-500/15 text-purple-500",
    "owner": "bg-emerald-500/15 text-emerald-500",
    "editor": "bg-blue-500/15 text-blue-500",
    "viewer": "bg-zinc-500/15 text-zinc-500"
  }
  return <Badge variant="outline" className={tone[role] ?? ""}>{role}</Badge>
}

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "./ThemeToggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function SiteHeader({ user }: { user: { email: string; name?: string | null } }) {
  const initial = (user.name || user.email)[0]?.toUpperCase() ?? "?"
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-2 h-4" />
      <div className="flex-1" />
      <ThemeToggle />
      <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{initial}</AvatarFallback></Avatar>
    </header>
  )
}

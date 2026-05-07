"use client"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { LogOut, Key, User } from "lucide-react"
import { toast } from "sonner"
import { ThemeSwitcher } from "./ThemeToggle"

type Props = {
  user: { email: string; name?: string | null; role: "super-admin" | "owner" | "editor" | "viewer" }
}

export function UserMenu({ user }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const initial = (user.name || user.email)[0]?.toUpperCase() ?? "?"

  const onLogout = () => start(async () => {
    const res = await fetch("/api/users/logout", { method: "POST" })
    if (!res.ok) {
      toast.error("Logout failed")
      return
    }
    router.replace("/login")
    router.refresh()
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-xs">{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-medium truncate">{user.name || user.email}</span>
          {user.name && <span className="text-xs text-muted-foreground truncate">{user.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="md:hidden p-0 focus:bg-transparent">
          <ThemeSwitcher />
        </DropdownMenuItem>
        <DropdownMenuSeparator className="md:hidden" />
        <DropdownMenuItem asChild>
          <a href="/profile"><User className="mr-2 h-4 w-4" /> Profile</a>
        </DropdownMenuItem>
        {user.role === "super-admin" && (
          <DropdownMenuItem asChild>
            <a href="/api-key"><Key className="mr-2 h-4 w-4" /> API key</a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" /> {pending ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

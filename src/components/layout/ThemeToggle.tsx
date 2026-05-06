"use client"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

/**
 * Three-state theme toggle: Light / Dark / System.
 *
 * - The trigger button keeps the existing Sun↔Moon swap animation based on the
 *   *resolved* theme (so picking "System" still shows the right icon for what
 *   the OS currently asks for).
 * - The dropdown lets the user pin an explicit theme or fall back to system
 *   preference. `next-themes` persists the choice in localStorage and reacts
 *   to OS changes when "system" is selected.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // `theme` is "light" | "dark" | "system" | undefined (during SSR/first paint).
  // Coerce undefined to "system" to keep the radio in a known state without
  // flicker after hydration.
  const value = theme ?? "system"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuRadioGroup value={value} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="mr-2 h-4 w-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="mr-2 h-4 w-4" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="mr-2 h-4 w-4" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

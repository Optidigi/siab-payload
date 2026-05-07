"use client"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

/**
 * Shadcn-aligned empty state for tables, lists, and content areas.
 * Use as the empty-rows render of DataTable, the no-blocks state of
 * BlockEditor (already uses this pattern inline), or any "no items"
 * surface across the admin.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-12 px-4 max-md:px-2 text-center border border-dashed rounded-lg",
        className,
      )}
    >
      <Icon className="h-10 w-10 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="text-base font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

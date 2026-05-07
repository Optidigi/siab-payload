"use client"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { ChevronLeft, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type TenantInfo = {
  name: string
  slug: string
}

type Props = {
  title: string
  subtitle?: React.ReactNode
  action?: React.ReactNode
  /**
   * Tenant context pill — shows on the left when this header is for a
   * tenant-scoped page. Tap → navigates to tenant overview.
   * Omit for admin-context pages.
   */
  tenant?: TenantInfo
  /**
   * Show a back button on the left. If `true` and `usePathname()` is
   * 3+ segments deep, renders a chevron back button calling
   * router.back(). Set explicitly to false to suppress.
   */
  showBack?: boolean
  className?: string
}

/**
 * Per-page header primitive. Stacks title above action on phone,
 * inlines on desktop. Optional tenant pill anchors super-admin
 * context. Optional back chevron for deep routes.
 *
 * Use at the top of every admin page that previously used an
 * ad-hoc <h1> + button row.
 *
 * Usage:
 *   <PageHeader title="Pages" tenant={tenant} action={<Button>+ New page</Button>} />
 */
export function PageHeader({ title, subtitle, action, tenant, showBack, className }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  // Auto-show back when 3+ segments deep, unless explicitly disabled.
  const segments = pathname?.split("/").filter(Boolean) ?? []
  const autoBack = segments.length >= 3
  const showBackButton = showBack ?? autoBack

  return (
    <header
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        {showBackButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            aria-label="Back"
            className="shrink-0 -ml-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0">
          {tenant && (
            <Link
              href={`/sites/${tenant.slug}`}
              className="inline-flex items-center gap-1.5 max-w-full truncate rounded-md border bg-muted/40 px-2 py-1 text-xs hover:bg-muted mb-1.5"
            >
              <Globe className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">{tenant.name}</span>
            </Link>
          )}
          <h1 className="text-lg sm:text-xl font-semibold truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action && (
        <div className="shrink-0 max-sm:w-full [&>*]:max-sm:w-full">{action}</div>
      )}
    </header>
  )
}

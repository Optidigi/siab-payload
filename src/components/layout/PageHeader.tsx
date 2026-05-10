import Link from "next/link"
import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type TenantInfo = {
  name: string
  slug: string
}

type Props = {
  title: string
  subtitle?: React.ReactNode
  action?: React.ReactNode
  /**
   * Tenant context — when present, renders a shadcn Breadcrumb above the
   * H1 with the tenant link as the parent crumb and the page title as
   * the current page. Tapping the tenant link navigates to the tenant
   * overview. Omit for admin-context pages where tenant context doesn't
   * apply.
   */
  tenant?: TenantInfo
  className?: string
}

/**
 * Per-page header primitive. Stacks title above action on phone,
 * inlines on desktop. Optional tenant context renders as a shadcn
 * Breadcrumb (UX-2026-0024 / GitHub issue #12 — replaces the bordered
 * "tag-style" pill with a proper hierarchy).
 *
 * Usage:
 *   <PageHeader title="Pages" tenant={tenant} action={<Button>+ New page</Button>} />
 */
export function PageHeader({ title, subtitle, action, tenant, className }: Props) {
  return (
    <header
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {tenant && (
          <Breadcrumb className="mb-1">
            <BreadcrumbList className="gap-1 sm:gap-1.5 text-xs sm:text-sm">
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbLink asChild className="inline-flex items-center gap-1 truncate">
                  <Link href={`/sites/${tenant.slug}`}>
                    <Globe className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{tenant.name}</span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <h1 className="text-lg sm:text-xl font-semibold truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="shrink-0 max-sm:w-full [&>*]:max-sm:w-full">{action}</div>
      )}
    </header>
  )
}

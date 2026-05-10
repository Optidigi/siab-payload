import Link from "next/link"
import { Globe } from "lucide-react"

type TenantInfo = {
  name: string
  slug: string
}

export function TenantPill({ tenant }: { tenant: TenantInfo }) {
  return (
    <Link
      href={`/sites/${tenant.slug}`}
      className="inline-flex items-center gap-1.5 max-w-full truncate rounded-md border bg-muted/40 px-2 py-1 text-xs hover:bg-muted"
    >
      <Globe className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{tenant.name}</span>
    </Link>
  )
}

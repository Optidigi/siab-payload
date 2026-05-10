import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { listPages } from "@/lib/queries/pages"
import { PagesTable } from "@/components/tables/PagesTable"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { EmptyState } from "@/components/empty-state"
import { FileText, Plus } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function PagesIndex({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const pages = await listPages(tenant.id)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pages"
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
        action={<Button asChild><Link href={`/sites/${slug}/pages/new`}><Plus className="mr-1 h-4 w-4"/> New page</Link></Button>}
      />
      <PagesTable
        data={pages as any}
        base={`/sites/${slug}/pages`}
        emptyState={
          <EmptyState
            icon={<FileText className="h-10 w-10 text-muted-foreground" aria-hidden />}
            title="No pages yet"
            description="Create your first page to start building this site."
            action={
              <Button asChild>
                <Link href={`/sites/${slug}/pages/new`}>
                  <Plus className="h-4 w-4 mr-1" /> New page
                </Link>
              </Button>
            }
          />
        }
      />
    </div>
  )
}

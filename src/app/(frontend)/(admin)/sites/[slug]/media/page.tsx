import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { listMedia } from "@/lib/queries/media"
import { getMediaUsage } from "@/lib/queries/mediaUsage"
import { MediaGrid } from "@/components/media/MediaGrid"
import { MediaUploader } from "@/components/media/MediaUploader"
import { PageHeader } from "@/components/layout/PageHeader"
import { notFound } from "next/navigation"

export default async function MediaPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const [items, usage] = await Promise.all([
    listMedia(tenant.id),
    getMediaUsage(tenant.id)
  ])
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Media"
        tenant={{ name: tenant.name, slug: tenant.slug }}
        action={<MediaUploader tenantId={tenant.id} />}
      />
      <MediaGrid items={items.docs as any} usage={usage} pagesBaseHref={`/sites/${slug}/pages`} />
    </div>
  )
}

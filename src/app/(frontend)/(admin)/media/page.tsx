import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { listMedia } from "@/lib/queries/media"
import { getMediaUsage } from "@/lib/queries/mediaUsage"
import { MediaGrid } from "@/components/media/MediaGrid"
import { MediaUploader } from "@/components/media/MediaUploader"
import { PageHeader } from "@/components/layout/PageHeader"

export default async function TenantMediaPage() {
  const { ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const [items, usage] = await Promise.all([
    listMedia(ctx.tenant.id),
    getMediaUsage(ctx.tenant.id)
  ])
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Media"
        action={<MediaUploader tenantId={ctx.tenant.id}/>}
      />
      <MediaGrid items={items.docs as any} usage={usage} pagesBaseHref="/pages" />
    </div>
  )
}

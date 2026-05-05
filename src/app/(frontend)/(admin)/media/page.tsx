import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/authGate"
import { listMedia } from "@/lib/queries/media"
import { MediaGrid } from "@/components/media/MediaGrid"
import { MediaUploader } from "@/components/media/MediaUploader"

export default async function TenantMediaPage() {
  const { ctx } = await requireAuth()
  if (ctx.mode === "super-admin") redirect("/sites")
  const items = await listMedia(ctx.tenant.id)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Media</h1>
        <MediaUploader tenantId={ctx.tenant.id}/>
      </div>
      <MediaGrid items={items.docs as any}/>
    </div>
  )
}

import type { Metadata } from "next"
import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { getPageById } from "@/lib/queries/pages"
import { PageForm } from "@/components/forms/PageForm"
import { PageHeader } from "@/components/page-header"
import { TenantPill } from "@/components/layout/TenantPill"
import { notFound } from "next/navigation"

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; id: string }> }
): Promise<Metadata> {
  const { slug, id } = await params
  const [tenant, page] = await Promise.all([getTenantBySlug(slug), getPageById(Number(id)).catch(() => null)])
  if (!tenant || !page) return { title: "Page" }
  return { title: `${page.title} · ${tenant.name}` }
}

export default async function EditPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  await requireRole(["super-admin"])
  const { slug, id } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  // FN-2026-0023 fix — `payload.findByID` throws on missing rows; the prior
  // shape `await getPageById(Number(id))` propagated the throw through to a
  // 500 server-component error before the `if (!page) notFound()` guard
  // could fire. Catch the throw, normalise to null, then let notFound()
  // render the standard 404 page. Mirror of the same `.catch(() => null)`
  // pattern already used in this file's `generateMetadata` (UX-2026-0001
  // batch-1).
  const page = await getPageById(Number(id)).catch(() => null)
  if (!page) notFound()
  const pageTenantId = typeof page.tenant === "object" && page.tenant ? page.tenant.id : page.tenant
  if (pageTenantId !== tenant.id) notFound()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={page.title}
        beforeTitle={<TenantPill tenant={{ name: tenant.name, slug: tenant.slug }} />}
      />
      <PageForm
        initial={page as any}
        tenantId={tenant.id}
        baseHref={`/sites/${slug}/pages`}
        // FN-2026-0047 — preview iframe origin. Production: https://<domain>.
        // Dev (no /etc/hosts entry, no NPM proxy): operator can set
        // NEXT_PUBLIC_PREVIEW_ORIGIN_OVERRIDE to a reachable URL (e.g.
        // http://localhost:5173). The pre-fix shape always built
        // https://${tenant.domain} and the iframe failed with
        // ERR_CONNECTION_REFUSED in any non-NPM dev setup.
        tenantOrigin={
          process.env.NEXT_PUBLIC_PREVIEW_ORIGIN_OVERRIDE ?? `https://${tenant.domain}`
        }
      />
    </div>
  )
}

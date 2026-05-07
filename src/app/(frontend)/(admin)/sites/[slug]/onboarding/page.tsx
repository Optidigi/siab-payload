import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist"
import { PageHeader } from "@/components/layout/PageHeader"
import { notFound } from "next/navigation"

export default async function OnboardingPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const vpsIp = process.env.NEXT_PUBLIC_VPS_IP ?? "set NEXT_PUBLIC_VPS_IP"
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <PageHeader
        title="Onboarding"
        tenant={{ name: tenant.name, slug: tenant.slug }}
        subtitle={<>Manual steps to bring <code>admin.{tenant.domain}</code> live.</>}
      />
      <OnboardingChecklist
        tenant={{ id: tenant.id, slug: tenant.slug, domain: tenant.domain ?? "" }}
        vpsIp={vpsIp}
      />
    </div>
  )
}

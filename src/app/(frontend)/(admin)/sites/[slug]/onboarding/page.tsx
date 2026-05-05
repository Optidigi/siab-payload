import { requireRole } from "@/lib/authGate"
import { getTenantBySlug } from "@/lib/queries/tenants"
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist"
import { notFound } from "next/navigation"

export default async function OnboardingPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireRole(["super-admin"])
  const { slug } = await params
  const tenant = await getTenantBySlug(slug)
  if (!tenant) notFound()
  const vpsIp = process.env.NEXT_PUBLIC_VPS_IP ?? "set NEXT_PUBLIC_VPS_IP"
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Onboarding — {tenant.name}</h1>
        <p className="text-sm text-muted-foreground">Manual steps to bring <code>admin.{tenant.domain}</code> live.</p>
      </div>
      <OnboardingChecklist
        tenant={{ id: tenant.id, slug: tenant.slug, domain: tenant.domain ?? "" }}
        vpsIp={vpsIp}
      />
    </div>
  )
}

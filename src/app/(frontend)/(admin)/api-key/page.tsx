import { requireRole } from "@/lib/authGate"
import { ApiKeyManager } from "@/components/forms/ApiKeyManager"
import { PageHeader } from "@/components/layout/PageHeader"

export default async function ApiKeyPage() {
  const { user } = await requireRole(["super-admin"])
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <PageHeader title="API key" />
      <ApiKeyManager user={user} />
    </div>
  )
}

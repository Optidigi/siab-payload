import { requireRole } from "@/lib/authGate"
import { ApiKeyManager } from "@/components/forms/ApiKeyManager"

export default async function ApiKeyPage() {
  const { user } = await requireRole(["super-admin"])
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-xl font-semibold">API key</h1>
      <ApiKeyManager user={user} />
    </div>
  )
}

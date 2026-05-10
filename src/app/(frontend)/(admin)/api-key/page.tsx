import { requireAuth } from "@/lib/authGate"
import { ApiKeyManager } from "@/components/forms/ApiKeyManager"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// AMD-3 — UI half of the honest-rejection fix. The server hook in
// src/collections/Users.ts now returns HTTP 403 on any non-super-admin
// PATCH that names apiKey/enableAPIKey/apiKeyIndex; rendering the manager
// for non-super-admin would put a button in front of a guaranteed 403, so
// instead we render a brief placeholder explaining the constraint. Super-
// admin path is unchanged.
export default async function ApiKeyPage() {
  const { user } = await requireAuth()
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <PageHeader title="API key" />
      {user.role === "super-admin" ? (
        <ApiKeyManager user={user} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>API key rotation is super-admin-only</CardTitle>
            <CardDescription>
              API keys are issued and rotated by your super-admin. If you need a
              key for machine access — or need an existing one rotated — contact
              your super-admin to request the change.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This restriction prevents persistent header-based credentials
              from being established or rotated outside the super-admin path.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

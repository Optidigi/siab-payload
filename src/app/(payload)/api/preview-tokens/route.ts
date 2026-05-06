import { NextRequest, NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { signPreviewToken } from "@/lib/preview/sign"

/**
 * POST /api/preview-tokens
 *
 * Body: { tenantId: number | string, pageId: number | string }
 *
 * Auth: caller must be an authenticated Payload user with read access to
 * the tenant. Super-admins can preview any tenant; everyone else only
 * their own (validated against the user's `tenants` array).
 *
 * Returns: { token: string, exp: number }
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })

  // Authenticate via Payload's session/cookie helper.
  type AuthUser = {
    id: number | string
    role: string
    tenants?: Array<{ tenant: number | string | { id: number | string } }>
  }

  let user: AuthUser | null
  try {
    const auth = await payload.auth({ headers: req.headers })
    user = auth.user as AuthUser | null
  } catch {
    user = null
  }
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  let body: { tenantId?: number | string; pageId?: number | string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }
  const { tenantId, pageId } = body
  if (tenantId == null || pageId == null) {
    return NextResponse.json({ message: "tenantId and pageId required" }, { status: 400 })
  }

  // Authorization: super-admin can preview any tenant; everyone else only
  // their own tenant.
  if (user.role !== "super-admin") {
    const userTenantIds = (user.tenants ?? []).map((t) =>
      typeof t.tenant === "object" ? t.tenant.id : t.tenant,
    )
    if (!userTenantIds.some((id) => id == tenantId)) {  // == on purpose: number/string compare
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }
  }

  const secret = process.env.PREVIEW_HMAC_SECRET
  if (!secret) {
    return NextResponse.json(
      { message: "Server misconfigured (PREVIEW_HMAC_SECRET unset)" },
      { status: 500 },
    )
  }

  try {
    const { token, exp } = signPreviewToken({ tenantId, pageId }, secret)
    return NextResponse.json({ token, exp })
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Token signing failed" },
      { status: 500 },
    )
  }
}

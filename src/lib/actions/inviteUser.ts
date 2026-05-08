"use server"
import { getPayload } from "payload"
import { headers } from "next/headers"
import config from "@/payload.config"
import crypto from "node:crypto"

// Resolve a Payload user.tenants[].tenant entry (which may be either the
// populated tenant doc or the bare FK id, depending on auth depth) to its id.
function ownerTenantId(user: { tenants?: { tenant: unknown }[] | null } | null) {
  const first = user?.tenants?.[0]?.tenant
  if (first == null) return null
  return typeof first === "object" ? (first as { id: number | string }).id : first
}

export async function inviteUser(input: {
  email: string
  name: string
  role: "owner" | "editor" | "viewer"
  tenantId: number | string
}) {
  const payload = await getPayload({ config })

  // Audit P0 #1: server actions are anonymous RPC primitives by default
  // (no built-in auth, action ID derivable from the bundled page). Resolve
  // the caller from the request cookies and gate explicitly.
  const { user: caller } = await payload.auth({ headers: await headers() })
  if (!caller) throw new Error("Forbidden: authentication required")
  if (caller.role !== "super-admin" && caller.role !== "owner") {
    throw new Error("Forbidden: only super-admin or owner may invite users")
  }
  if (caller.role === "owner") {
    const ownTenant = ownerTenantId(caller as any)
    if (ownTenant == null || String(ownTenant) !== String(input.tenantId)) {
      throw new Error("Forbidden: owner may only invite into own tenant")
    }
  }

  const tempPassword = crypto.randomBytes(16).toString("hex")
  // Pass `user: caller` (NOT overrideAccess: true) so Payload's collection
  // and field-level access rules — including the role/tenants gates added in
  // audit P0 #2/#3 — apply to this create. An owner therefore cannot, for
  // example, mint a super-admin even by editing the input role server-side.
  const created = await payload.create({
    collection: "users",
    user: caller,
    data: {
      email: input.email,
      name: input.name,
      role: input.role,
      tenants: [{ tenant: input.tenantId }],
      password: tempPassword
    } as any
  })
  // Trigger forgot-password to send the invite link with reset token.
  // Email transport isn't configured until Phase 15; until then this silently
  // no-ops the email send but completes the action successfully.
  try {
    await payload.forgotPassword({ collection: "users", data: { email: input.email } })
  } catch (err) {
    payload.logger.warn({ err, email: input.email }, "[invite] forgot-password no-op (email not configured?)")
  }
  return { ok: true as const, id: created.id }
}

"use server"
import { getPayload } from "payload"
import config from "@/payload.config"
import crypto from "node:crypto"

export async function inviteUser(input: {
  email: string
  name: string
  role: "owner" | "editor" | "viewer"
  tenantId: number | string
}) {
  const payload = await getPayload({ config })
  const tempPassword = crypto.randomBytes(16).toString("hex")
  const created = await payload.create({
    collection: "users",
    overrideAccess: true,
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

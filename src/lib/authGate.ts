import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"
import { getSiabContext, type SiabContext } from "@/lib/context"
import { evaluateGate } from "@/lib/gateDecision"
import type { User } from "@/payload-types"

export type GateResult = { user: User; ctx: SiabContext }

/**
 * RSC helper. Resolves siab context, then validates the authenticated user
 * against the host × role × tenant matrix from the spec:
 *
 *   no user                                                  -> /login
 *   super-admin host, user.role !== super-admin              -> /login?error=wrong-host
 *   tenant host, user.role === super-admin                   -> /login?error=super-admin-on-tenant-host
 *   tenant host, user.tenants[0].tenant !== ctx.tenant.id    -> /login?error=cross-tenant
 *   otherwise                                                -> { user, ctx }
 *
 * Cross-tenant cookie reuse is impossible by browser rules (host-scoped
 * cookies), but the gate is double-checked here in case of credential
 * mishandling (e.g., a backup-restore that crosses tenants).
 */
export const requireAuth = async (): Promise<GateResult> => {
  const ctx = await getSiabContext()
  const payload = await getPayload({ config })

  const headersList = await headers()
  const cookieStore = await cookies()

  // Build a Headers object Payload can read for auth (it expects a Web Headers
  // shape with the request's cookie header).
  const reqHeaders = new Headers()
  headersList.forEach((value, key) => {
    reqHeaders.set(key, value)
  })
  const cookieHeader = cookieStore.toString()
  if (cookieHeader) reqHeaders.set("cookie", cookieHeader)

  const result = await payload.auth({ headers: reqHeaders })
  const user = result.user as User | null

  const decision = evaluateGate(user, ctx)
  if (!decision.allow) {
    if (decision.reason === "no-user") redirect("/login")
    redirect(`/login?error=${decision.reason}`)
  }

  // evaluateGate returned allow:true above, so user is non-null here.
  return { user: user as User, ctx }
}

/**
 * Convenience wrapper: requireAuth + role check. Common for super-admin-only
 * routes (e.g. /sites, /sites/<slug>/onboarding).
 */
export const requireRole = async (
  allowed: NonNullable<User["role"]>[]
): Promise<GateResult> => {
  const result = await requireAuth()
  if (!allowed.includes(result.user.role)) redirect("/?error=forbidden")
  return result
}

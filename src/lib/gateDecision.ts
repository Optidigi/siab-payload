import type { SiabContext } from "@/lib/context"
import type { User } from "@/payload-types"

export type GateDecision =
  | { allow: true }
  | { allow: false; reason: "no-user" | "wrong-host" | "super-admin-on-tenant-host" | "cross-tenant" }

/**
 * Pure decision function for the host × role × tenant matrix. Lives apart
 * from `authGate.ts` so unit tests can import it without booting Payload.
 *
 * The matrix:
 *   no user                                              -> no-user
 *   super-admin host, user.role !== super-admin          -> wrong-host
 *   tenant host,      user.role === super-admin          -> super-admin-on-tenant-host
 *   tenant host,      user.tenant !== ctx.tenant.id      -> cross-tenant
 *   otherwise                                            -> allow
 */
export const evaluateGate = (user: User | null, ctx: SiabContext): GateDecision => {
  if (!user) return { allow: false, reason: "no-user" }

  if (ctx.mode === "super-admin") {
    if (user.role !== "super-admin") return { allow: false, reason: "wrong-host" }
    return { allow: true }
  }

  // ctx.mode === "tenant"
  if (user.role === "super-admin") {
    return { allow: false, reason: "super-admin-on-tenant-host" }
  }

  const userTenantId =
    user.tenant && typeof user.tenant === "object"
      ? (user.tenant as { id: number | string }).id
      : user.tenant
  if (userTenantId !== ctx.tenant.id) {
    return { allow: false, reason: "cross-tenant" }
  }
  return { allow: true }
}

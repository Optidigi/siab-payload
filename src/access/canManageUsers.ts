import type { Access, Where } from "payload"

export const canManageUsers: Access = ({ req }) => {
  const u = req.user
  if (!u) return false
  if (u.role === "super-admin") return true
  if (u.role === "owner") {
    // u.tenant is `number | string | Tenant | null | undefined` (string only in tests).
    // Reduce to a plain id value.
    const tenantId =
      u.tenant && typeof u.tenant === "object" ? (u.tenant as { id: number | string }).id : u.tenant
    if (tenantId == null) return false
    return { tenant: { equals: tenantId } } as Where
  }
  return { id: { equals: u.id } } as Where
}

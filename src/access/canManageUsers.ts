import type { Access, Where } from "payload"

export const canManageUsers: Access = (args) => {
  const u = (args as any).user ?? args.req?.user
  if (!u) return false
  if (u.role === "super-admin") return true
  if (u.role === "owner") {
    const tenantId = typeof u.tenant === "string" ? u.tenant : u.tenant?.id
    if (!tenantId) return false
    return { tenant: { equals: tenantId } } as Where
  }
  return { id: { equals: u.id } } as Where
}

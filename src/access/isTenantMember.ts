import type { Access } from "payload"

export const isTenantMember: Access = ({ req }) => {
  const u = req.user
  return Boolean(u && u.role !== "super-admin" && Array.isArray((u as any).tenants) && (u as any).tenants.length > 0)
}

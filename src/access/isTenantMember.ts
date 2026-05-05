import type { Access } from "payload"

export const isTenantMember: Access = ({ req }) => {
  const u = req.user
  return Boolean(u && u.role !== "super-admin" && u.tenant)
}

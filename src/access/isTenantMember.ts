import type { Access } from "payload"
import type { User } from "@/payload-types"

export const isTenantMember: Access = ({ req }) => {
  const u = req.user as User | null
  return Boolean(u && u.role !== "super-admin" && Array.isArray(u.tenants) && u.tenants.length > 0)
}

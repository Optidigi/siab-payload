import type { Access } from "payload"

export const isTenantMember: Access = (args) => {
  const u = (args as any).user ?? args.req?.user
  return Boolean(u && u.role !== "super-admin" && u.tenant)
}

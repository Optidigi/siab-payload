import type { Access } from "payload"

export const isOwnerInTenant: Access = (args) => {
  const user = (args as any).user ?? args.req?.user
  return user?.role === "owner"
}

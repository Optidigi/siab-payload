import type { Access } from "payload"

export const isSuperAdmin: Access = (args) => {
  const user = (args as any).user ?? args.req?.user
  return user?.role === "super-admin"
}

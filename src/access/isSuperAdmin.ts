import type { Access } from "payload"

export const isSuperAdmin: Access = ({ req }) =>
  req.user?.role === "super-admin"

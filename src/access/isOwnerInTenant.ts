import type { Access } from "payload"

export const isOwnerInTenant: Access = ({ req }) =>
  req.user?.role === "owner"

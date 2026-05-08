import type { Access, FieldAccess } from "payload"

export const isSuperAdmin: Access = ({ req }) =>
  req.user?.role === "super-admin"

// Field-level variant — Payload distinguishes collection-level `Access` from
// `FieldAccess` (different `id` arg shape). Used by Users.role / Users.tenants
// to block role/tenant escalation by non-super-admin callers (audit P0 #2/#3).
export const isSuperAdminField: FieldAccess = ({ req }) =>
  req.user?.role === "super-admin"

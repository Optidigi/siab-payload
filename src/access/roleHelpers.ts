import type { Access } from "payload"

/**
 * Role-layer access on top of the multi-tenant plugin's automatic
 * tenant scoping. The plugin already restricts queries to the user's
 * tenant for non-super-admin roles; these helpers enforce *what* each
 * role can do within that scope.
 *
 *   - viewer  -> read only
 *   - editor  -> create / read / update / delete on Pages, Media, Forms
 *   - owner   -> editor's permissions + update SiteSettings
 *   - super-admin -> everything everywhere (bypasses tenant scoping
 *                    via plugin's userHasAccessToAllTenants)
 */
export const canRead: Access = ({ req }) => Boolean(req.user)

export const canWrite: Access = ({ req }) => {
  const role = req.user?.role
  return role === "super-admin" || role === "owner" || role === "editor"
}

export const canUpdateSettings: Access = ({ req }) => {
  const role = req.user?.role
  return role === "super-admin" || role === "owner"
}

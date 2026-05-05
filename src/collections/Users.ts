import type { ArrayFieldValidation, CollectionConfig } from "payload"
import { canManageUsers } from "@/access/canManageUsers"
import { resetPasswordTemplate } from "@/lib/email/templates/resetPassword"

// Domain invariant: super-admins have no tenants; all other roles have
// exactly one. Multiple users may share the same tenant (clients can add
// team members), but a single user is always scoped to one tenant.
const validateTenants: ArrayFieldValidation = (value, { siblingData }: any) => {
  const role = siblingData?.role
  const len = Array.isArray(value) ? value.length : 0
  if (role === "super-admin") {
    if (len !== 0) return "super-admin users must not have tenants"
    return true
  }
  if (len !== 1) return "exactly one tenant is required for non-super-admin users"
  return true
}

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    useAPIKey: true,
    forgotPassword: {
      generateEmailHTML: async (args) => {
        const token = (args as any)?.token as string | undefined
        const user = (args as any)?.user as any
        const req = (args as any)?.req

        let host = `admin.${process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN || "siteinabox.nl"}`
        const firstTenant = user?.tenants?.[0]?.tenant
        if (user && user.role !== "super-admin" && firstTenant) {
          const tenantId = typeof firstTenant === "object" && firstTenant ? firstTenant.id : firstTenant
          try {
            const tenant = await req.payload.findByID({
              collection: "tenants",
              id: tenantId,
              overrideAccess: true
            })
            if (tenant?.domain) host = `admin.${tenant.domain}`
          } catch {
            // Fall back to super-admin host if the tenant can't be resolved
          }
        }

        const proto = process.env.NODE_ENV === "production" ? "https" : "http"
        const port = process.env.NODE_ENV === "production" ? "" : `:${process.env.PORT || 3001}`
        const resetUrl = `${proto}://${host}${port}/reset-password/${token ?? ""}`
        return resetPasswordTemplate({ resetUrl }).html
      },
      generateEmailSubject: () => "Reset your siab-payload password"
    }
  },
  access: {
    // create: super-admin / owner can create. Bootstrap exception: if there
    // are zero users, allow unauthenticated creation so the first super-admin
    // can be seeded via POST /api/users on a fresh production database.
    // Once any user exists, this lock is permanent.
    create: async ({ req }) => {
      if (req.user?.role === "super-admin" || req.user?.role === "owner") return true
      const { totalDocs } = await req.payload.count({ collection: "users", overrideAccess: true })
      return totalDocs === 0
    },
    read: canManageUsers,
    update: canManageUsers,
    delete: ({ req }) => req.user?.role === "super-admin" || req.user?.role === "owner"
  },
  admin: { useAsTitle: "email", defaultColumns: ["email", "name", "role"] },
  fields: [
    { name: "name", type: "text" },
    { name: "role", type: "select", required: true, defaultValue: "editor",
      options: [
        { label: "Super-admin", value: "super-admin" },
        { label: "Owner", value: "owner" },
        { label: "Editor", value: "editor" },
        { label: "Viewer", value: "viewer" }
      ] },
    // Plugin-native many-to-many shape. We declare it manually (rather than
    // relying on the plugin's `includeDefaultField: true` injection) so we
    // can attach a custom validate enforcing the per-role tenant invariant.
    // The plugin's access wrappers and base filter look up users by
    // `tenants.tenant`, so the field name + row shape must match the plugin
    // defaults exactly.
    {
      name: "tenants",
      type: "array",
      validate: validateTenants,
      saveToJWT: true,
      admin: { description: "empty for super-admin; exactly one entry otherwise" },
      fields: [
        {
          name: "tenant",
          type: "relationship",
          relationTo: "tenants",
          required: true,
          index: true,
          saveToJWT: true
        }
      ]
    }
  ]
}

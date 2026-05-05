import type { CollectionConfig, RelationshipFieldValidation } from "payload"
import { canManageUsers } from "@/access/canManageUsers"
import { resetPasswordTemplate } from "@/lib/email/templates/resetPassword"

const validateTenant: RelationshipFieldValidation = (value, { siblingData }: any) => {
  const role = siblingData?.role
  if (role === "super-admin") {
    if (value) return "super-admin users must not have a tenant"
    return true
  }
  if (!value) return "tenant is required for non-super-admin users"
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
        if (user && user.role !== "super-admin" && user.tenant) {
          const tenantId = typeof user.tenant === "object" && user.tenant ? user.tenant.id : user.tenant
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
  admin: { useAsTitle: "email", defaultColumns: ["email", "name", "role", "tenant"] },
  fields: [
    { name: "name", type: "text" },
    { name: "role", type: "select", required: true, defaultValue: "editor",
      options: [
        { label: "Super-admin", value: "super-admin" },
        { label: "Owner", value: "owner" },
        { label: "Editor", value: "editor" },
        { label: "Viewer", value: "viewer" }
      ] },
    { name: "tenant", type: "relationship", relationTo: "tenants",
      validate: validateTenant,
      admin: { description: "null for super-admin; required otherwise" } }
  ]
}

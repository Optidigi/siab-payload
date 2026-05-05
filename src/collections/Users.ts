import type { CollectionConfig, RelationshipFieldValidation } from "payload"
import { canManageUsers } from "@/access/canManageUsers"

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
  auth: { useAPIKey: true },
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

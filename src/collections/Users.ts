import type { CollectionConfig, RelationshipFieldValidation } from "payload"

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

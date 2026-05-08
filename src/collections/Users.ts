import { timingSafeEqual } from "crypto"
import type { ArrayFieldValidation, CollectionConfig, FieldAccess } from "payload"
import { canManageUsers } from "@/access/canManageUsers"
import { isSuperAdminField } from "@/access/isSuperAdmin"
import { resetPasswordTemplate } from "@/lib/email/templates/resetPassword"

// Constant-time string compare. Length-mismatch returns false immediately
// (timingSafeEqual itself throws on length mismatch); the per-byte compare
// only runs on equal-length inputs. Used by the bootstrap-token gate so
// brute-force probes can't extract the env-var token byte-by-byte.
const safeEqual = (a: string, b: string): boolean => {
  const ab = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

// Shared check used by both the collection-level access.create gate AND the
// field-level isSuperAdminOrBootstrapField below. Keeping the two paths in
// lock-step prevents the field gate from stripping `role`/`tenants` on a
// caller that the collection gate is about to admit.
const requestHasValidBootstrapToken = (req: any): boolean => {
  const expected = process.env.BOOTSTRAP_TOKEN
  if (!expected) return false
  const provided = req?.headers?.get?.("x-bootstrap-token")
  if (!provided) return false
  return safeEqual(provided, expected)
}

// Bootstrap-aware variant of isSuperAdminField — used for `role.access.create`
// and `tenants.access.create` so the BOOTSTRAP_TOKEN seed path (audit-p1 #6)
// can actually mint the first super-admin. Without this, batch-1's
// isSuperAdminField would strip `role` and `tenants` from the anonymous
// bootstrap payload (req.user null → returns false), defaultValue
// `"editor"` would fill `role`, and validateTenants would reject the row
// (`exactly one tenant required for non-super-admin`).
//
// Update access stays gated by `isSuperAdminField` — the relaxation is
// CREATE-only. A stolen token + session cookie must NOT promote anyone
// via PATCH (audit P0 #2/#3 family).
//
// This function does NOT verify totalDocs === 0 — the collection-level
// gate at Users.access.create handles that. The field gate's job is to
// not strip the field on the legitimate bootstrap path.
const isSuperAdminOrBootstrapField: FieldAccess = ({ req }) => {
  if (req.user?.role === "super-admin") return true
  // Bootstrap exception is anonymous-only. Authed non-super-admin callers
  // (owner / editor / viewer) must not be relaxed — they have legitimate
  // UI flows and the bootstrap conditions don't apply to them.
  if (req.user) return false
  return requestHasValidBootstrapToken(req)
}

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
    // create: super-admin / owner can create. Bootstrap exception (audit-p1
    // finding #6, T2): the previous count-only gate silently re-opened
    // unauthenticated POST /api/users whenever the users table was empty
    // (DB restore from blank, accidental purge, fresh re-deploy missing
    // seed). The hardened gate now requires ALL of:
    //   1. `BOOTSTRAP_TOKEN` env var set on the server
    //   2. `x-bootstrap-token` request header matches it (timing-safe compare)
    //   3. incoming `data.role === "super-admin"` (no other role may bootstrap)
    //   4. users table is still empty
    // Operator workflow: deploy with BOOTSTRAP_TOKEN set, run the seed curl
    // ONCE, then unset BOOTSTRAP_TOKEN and redeploy. Documented in
    // .env.example and docs/runbooks/deploy.md.
    create: async ({ req, data }) => {
      if (req.user?.role === "super-admin" || req.user?.role === "owner") return true
      if (!requestHasValidBootstrapToken(req)) return false
      if (data?.role !== "super-admin") return false
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
      // Field-level access. Update is super-admin-only — closes Findings
      // #2/#3 (PATCH /api/users/<self> with role:"super-admin"). Create
      // permits super-admin OR the anonymous bootstrap path (audit-p1 #6)
      // so the first super-admin can be seeded; owner/editor/viewer are
      // still blocked, closing the same family on POST. The collection-level
      // gate at Users.access.create independently enforces
      // `totalDocs === 0` and `data.role === "super-admin"` for the
      // bootstrap path, so the field-level relaxation cannot widen the
      // attack surface.
      access: { create: isSuperAdminOrBootstrapField, update: isSuperAdminField },
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
      // Field-level access paired with `role`: setting `tenants:[]` while
      // flipping `role:"super-admin"` is the precise self-promotion shape
      // `validateTenants` accepts. Update remains super-admin-only; create
      // also permits the anonymous bootstrap path (audit-p1 #6) so the
      // legitimate first-seed payload is not stripped by field access.
      access: { create: isSuperAdminOrBootstrapField, update: isSuperAdminField },
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

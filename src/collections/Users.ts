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
// field-level canCreateUserField below. Keeping the two paths in lock-step
// prevents the field gate from stripping `role`/`tenants` on a caller that
// the collection gate is about to admit.
const requestHasValidBootstrapToken = (req: any): boolean => {
  const expected = process.env.BOOTSTRAP_TOKEN
  if (!expected) return false
  const provided = req?.headers?.get?.("x-bootstrap-token")
  if (!provided) return false
  return safeEqual(provided, expected)
}

// Mirror of `ownerTenantId` in src/lib/actions/inviteUser.ts:9-13. Inlined
// here (rather than imported) because that file is "use server" — every
// export must be an async function, so a sync helper can't be re-exported.
// Keep the two copies in sync; both resolve user.tenants[0].tenant (which
// may be a populated doc or a bare FK id depending on auth depth) to its id.
const ownerTenantIdOf = (user: any): unknown => {
  const first = user?.tenants?.[0]?.tenant
  if (first == null) return null
  return typeof first === "object" ? first.id : first
}

// Field-access gate for `role.access.create` AND `tenants.access.create` ONLY.
// Update access on these fields stays `isSuperAdminField` — the relaxation
// here is CREATE-only; the stolen-cookie PATCH vector (audit P0 #2/#3) must
// remain closed and is verified by the AMD-1 test's update-access guard case.
//
// Admits exactly:
//   A) super-admin (any role, any tenants shape)
//   B) anonymous + valid BOOTSTRAP_TOKEN AND data.role === "super-admin"
//      (the field gate must agree with the collection-level bootstrap gate at
//      Users.access.create — both require role=super-admin so a token leak
//      cannot mint editor/viewer/owner; re-arm guard for audit-p1 #6).
//   C) owner whose own tenant matches data.tenants[0].tenant AND
//      data.role ∈ {"editor", "viewer"}. tenants must be exactly length 1
//      (matching `validateTenants`'s non-super-admin invariant). Tenant-id
//      compare uses String(a) === String(b) for the populated-vs-FK shape.
// Everything else (editor, viewer, owner with disallowed role/tenant,
// anonymous without token, anonymous with token but wrong role) → false.
//
// AMD-1 (T2 secondary): closes the functional regression introduced by P0
// commit cb00e47 (which wired isSuperAdminField on role/tenants create) while
// preserving every closed P0/P1 vector.
const canCreateUserField: FieldAccess = ({ req, data }) => {
  // A) super-admin shortcut
  if (req.user?.role === "super-admin") return true

  // B) anonymous bootstrap path — anonymous-only, role-restricted to
  // super-admin to match the collection-level gate. Authed callers with a
  // token cookie must NOT be relaxed (their session already routes them
  // through the normal UI path; relaxing them would re-open P0 #2/#3 for
  // any operator who left BOOTSTRAP_TOKEN set in production).
  if (req.user == null) {
    if (!requestHasValidBootstrapToken(req)) return false
    return data?.role === "super-admin"
  }

  // C) owner-invite path. Tightly bound: role must be editor or viewer,
  // tenants[] must contain exactly one entry that matches the caller's
  // own tenant. Owner cannot mint another owner (no role-promotion within
  // tenant) or a super-admin (re-arm guard for P0 #2/#3); cannot invite
  // into a tenant they don't own (T1 cross-tenant guard).
  if (req.user.role === "owner") {
    if (data?.role !== "editor" && data?.role !== "viewer") return false
    const own = ownerTenantIdOf(req.user)
    if (own == null) return false
    const tenants = (data as any)?.tenants
    if (!Array.isArray(tenants) || tenants.length !== 1) return false
    const target = tenants[0]?.tenant
    if (target == null) return false
    return String(target) === String(own)
  }

  // D) editor / viewer / any other authed role → never permitted on create.
  return false
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
      // is gated by `canCreateUserField`, which admits: super-admin (any),
      // anonymous + bootstrap-token + role=super-admin (audit-p1 #6 seed),
      // and owner inviting editor/viewer into own tenant (AMD-1 owner
      // invite path). Editor / viewer / owner attempting any other shape
      // are blocked, closing the P0 #2/#3 family on POST as well.
      access: { create: canCreateUserField, update: isSuperAdminField },
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
      // uses `canCreateUserField` which mirrors the role gate so neither
      // half of the payload can be assembled in isolation.
      access: { create: canCreateUserField, update: isSuperAdminField },
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
    },
    // Audit AMENDMENT AMD-2 (T2 primary, T5 secondary) — Payload's
    // auto-injected `apiKey` / `enableAPIKey` / `apiKeyIndex` fields ship
    // with NO `access` property (see node_modules/payload/dist/auth/baseFields/apiKey.js).
    // Per Payload's default-allow-when-unspecified, any caller who passes
    // the collection-level access can mass-assign these fields, producing:
    //   A) owner mints attacker-known apiKey on a new editor (bypass invite-flow)
    //   B) editor/viewer self-set apiKey for persistence past password rotation
    //   C) owner sets apiKey on any tenant member → audit-trail forgery
    //      (owner can authenticate as victim; updatedBy reflects victim id)
    //
    // Mechanism: field-override via name-match. Payload's mergeBaseFields
    // (node_modules/payload/dist/fields/mergeBaseFields.js:7-31) finds the
    // base field by `name`, splices it from the merged list, and pushes
    // deepMergeWithReactComponents(baseField, matchCopy). Default deepmerge
    // semantics (utilities/deepMerge.js:37-41) have matchCopy (this collection's
    // explicit field) winning on conflicts while preserving baseField's
    // unique properties — so declaring only {name, type, access} here yields
    // a merged field that retains the baseField's encrypt/decrypt hooks,
    // admin Field:false, label, and (for apiKeyIndex) the HMAC beforeValidate
    // hook, while picking up our isSuperAdminField gate.
    //
    // Defense-in-depth: locking apiKey alone is transitively sufficient
    // (the apiKeyIndex hook only runs HMAC when data.apiKey is present,
    // which it won't be after the field-strip cascade). We lock all three
    // anyway so a future Payload revision that wires the hook differently
    // can't silently re-arm this vector.
    //
    // Self-rotation note: this locks editor/viewer/owner from rotating
    // their own apiKey via PATCH /api/users/<self>. The Payload-admin's
    // auto-injected apiKey UI is hidden (admin.components.Field: false),
    // BUT a custom self-rotation UI exists at src/components/forms/
    // ApiKeyManager.tsx (mounted on src/app/(frontend)/(admin)/api-key/
    // page.tsx). After this gate, that PATCH returns 200 with the apiKey/
    // enableAPIKey fields silently stripped — the UI appears to succeed but
    // the api-key state never changes for non-super-admin users. This is a
    // known functional regression flagged in audits/05-fix-batch-4-report.md
    // out-of-batch observations. Closing the security vector is the
    // priority; reconciling the UI is a product decision deferred to a
    // future amendment (options: narrow access to `req.user?.id === id`
    // for self-rotation, or replace the UI with a super-admin-mediated
    // request flow). Do not silently relax the access here.
    { name: "enableAPIKey", type: "checkbox", access: { create: isSuperAdminField, update: isSuperAdminField } },
    { name: "apiKey",       type: "text",     access: { create: isSuperAdminField, update: isSuperAdminField } },
    { name: "apiKeyIndex",  type: "text",     access: { create: isSuperAdminField, update: isSuperAdminField } }
  ]
}

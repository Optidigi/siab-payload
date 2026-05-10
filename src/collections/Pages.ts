import type { CollectionBeforeValidateHook, CollectionConfig } from "payload"
import { ValidationError } from "payload"
import { canRead, canWrite } from "@/access/roleHelpers"
import { Hero } from "@/blocks/Hero"
import { FeatureList } from "@/blocks/FeatureList"
import { Testimonials } from "@/blocks/Testimonials"
import { FAQ } from "@/blocks/FAQ"
import { CTA } from "@/blocks/CTA"
import { RichText } from "@/blocks/RichText"
import { ContactSection } from "@/blocks/ContactSection"
import { projectPageToDisk } from "@/hooks/projectToDisk"
import { deletePageFile } from "@/hooks/deleteFileFromDisk"
import { validateTenantExists } from "@/hooks/validateTenantExists"

// FN-2026-0004 — same client-server validation gap as Tenants.slug. Direct
// PATCH /api/pages/:id bypassed the form's zod regex; persisted "BAD SLUG!"
// in the audit. Mirror of `src/components/forms/PageForm.tsx` + `TenantForm`.
const PAGE_SLUG_REGEX = /^[a-z0-9-]+$/
const validatePageSlug = (val: unknown) => {
  if (val == null || val === "") return "Slug is required"
  if (typeof val !== "string" || !PAGE_SLUG_REGEX.test(val)) {
    return "Lowercase, digits, hyphens only"
  }
  return true
}

// Audit finding #8 (P1, T8) — pre-empt the (tenant_id, slug) unique-index
// violation surfaced by `20260509_pages_tenant_slug_unique` with a clean
// ValidationError. Without this hook, a duplicate-slug write reaches the DB
// and Postgres returns a raw "duplicate key value violates unique constraint
// pages_tenant_slug_idx" error — Payload v3.84.1 has no built-in translator
// for unique-violation errors (verified by absence of error-code mapping in
// node_modules/@payloadcms/db-postgres/dist/), so the user would otherwise
// see the raw constraint name in the admin UI.
//
// Tenant id-shape note: Payload returns the tenant relationship as either a
// scalar id (FK shape) or a populated object depending on auth depth. The
// helper handles both shapes — same defensive pattern used by `canManageUsers`
// (`String(a) === String(b)` to compare populated-vs-FK).
const extractTenantId = (t: unknown): string | number | undefined => {
  if (t == null) return undefined
  if (typeof t === "object" && "id" in (t as object)) {
    return (t as { id: number | string }).id
  }
  return t as string | number
}

const ensureUniqueTenantSlug: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data

  const slug = data.slug ?? originalDoc?.slug
  const tenantRaw = data.tenant !== undefined ? data.tenant : originalDoc?.tenant
  const tenantId = extractTenantId(tenantRaw)

  // Defensive skips — let Payload's `required` and the multi-tenant plugin's
  // tenant validator surface the missing-field error. The unique check only
  // runs once both fields are populated.
  if (slug == null || tenantId == null) return data

  // On update, short-circuit when neither slug nor tenant is changing. Avoids
  // a spurious DB round-trip on every PATCH that touches unrelated fields
  // (e.g. `title`, `blocks`).
  if (operation === "update") {
    const slugChanged =
      data.slug !== undefined && String(data.slug) !== String(originalDoc?.slug)
    const tenantChanged =
      data.tenant !== undefined &&
      String(extractTenantId(data.tenant)) !== String(extractTenantId(originalDoc?.tenant))
    if (!slugChanged && !tenantChanged) return data
  }

  // Self-exclusion: on update, the existing row IS the page being saved; that
  // must not count as a collision. On create, originalDoc is undefined.
  const selfExclusion =
    originalDoc?.id != null ? [{ id: { not_equals: originalDoc.id } }] : []

  const existing = await req.payload.find({
    collection: "pages",
    overrideAccess: true,
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { slug: { equals: slug } },
        ...selfExclusion,
      ],
    },
  })

  if (existing.totalDocs > 0) {
    throw new ValidationError({
      collection: "pages",
      errors: [
        {
          path: "slug",
          message: `A page with slug "${slug}" already exists in this tenant. Choose a different slug.`,
        },
      ],
    })
  }

  return data
}

export const Pages: CollectionConfig = {
  slug: "pages",
  access: { read: canRead, create: canWrite, update: canWrite, delete: canWrite },
  admin: { useAsTitle: "title", defaultColumns: ["title", "slug", "status", "updatedAt"] },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true, validate: validatePageSlug,
      admin: { description: "URL slug. Unique per tenant. 'home' for the root page." } },
    { name: "status", type: "select", required: true, defaultValue: "draft",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" }
      ]},
    { name: "blocks", type: "blocks",
      blocks: [Hero, FeatureList, Testimonials, FAQ, CTA, RichText, ContactSection] },
    { name: "seo", type: "group", fields: [
      { name: "title", type: "text" },
      { name: "description", type: "textarea" },
      { name: "ogImage", type: "upload", relationTo: "media" }
    ]},
    { name: "updatedBy", type: "relationship", relationTo: "users",
      admin: { readOnly: true, hidden: false } }
  ],
  hooks: {
    beforeValidate: [validateTenantExists, ensureUniqueTenantSlug],
    beforeChange: [({ data, req }) => {
      if (req.user) data.updatedBy = req.user.id
      return data
    }],
    afterChange: [projectPageToDisk],
    afterDelete: [deletePageFile]
  }
}

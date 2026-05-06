import type { CollectionConfig } from "payload"
import { canRead, canWrite } from "@/access/roleHelpers"
import { BLOCKS } from "@/blocks/registry"

/**
 * Block presets — tenant-scoped, reusable templates for one configured block.
 *
 * The user picks a Hero (or any other block) on a page, fills in its fields,
 * then "saves as preset" so the same shape can be inserted on another page
 * pre-filled. The picker filters by `blockType` so a Hero preset only ever
 * inserts as a Hero.
 *
 * Storage: `data` is a single jsonb column carrying the verbatim RHF values
 * for one block (sans the synthetic `.id` RHF adds). We do NOT mirror the
 * block's nested Payload schema here — that would double maintenance and
 * break any time we touch a block. Trade: no admin-UI editing of preset
 * internals; recreate-on-change is the MVP path.
 *
 * Immutability: once a preset is saved, `data` is locked (field-level
 * `access.update: () => false`). Operators can rename / re-describe via
 * the standard collection update path, but not edit the preset body. This
 * sidesteps "what if my page's block diverged from the preset" semantics.
 *
 * Tenant scoping: handled by `multiTenantPlugin` (see `payload.config.ts`).
 * Tenant-shared, not per-user: a preset is visible to every tenant member
 * with `canRead`. `createdBy` is recorded for attribution but not used for
 * access control.
 *
 * Hooks: deliberately NO `afterChange: [projectPageToDisk]`. Presets live
 * in the DB only; they don't project to per-tenant disk artefacts.
 */
export const BlockPresets: CollectionConfig = {
  slug: "block-presets",
  access: {
    read: canRead,
    create: canWrite,
    update: canWrite,
    delete: canWrite
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "blockType", "createdBy", "updatedAt"],
    description: "Reusable block templates. Save a configured block; insert it pre-filled on any page in this tenant."
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      maxLength: 60,
      admin: { description: "Operator-facing label, e.g. 'Homepage hero — spring 2026'." }
    },
    {
      name: "description",
      type: "textarea",
      maxLength: 200,
      admin: { description: "Optional short note about when to use this preset." }
    },
    {
      name: "blockType",
      type: "select",
      required: true,
      options: BLOCKS.map((b) => ({ label: b.slug, value: b.slug })),
      admin: { description: "Which block type this preset can be inserted as. Read-only after creation." },
      // Block-type compatibility: also enforced structurally by the picker
      // UI (preset rows live under their block-type tile) and by
      // BlockEditor.onAdd, which always trusts the picker's slug, never
      // the preset's stored blockType.
      access: { update: () => false }
    },
    {
      name: "data",
      type: "json",
      required: true,
      defaultValue: {},
      admin: { description: "Verbatim block field values captured at save time." },
      // Immutable post-create. Renames/redescribes go through name/description.
      access: { update: () => false }
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true, hidden: false }
    }
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        // Only stamp on insert; update operations cannot rewrite createdBy
        // anyway because of the field's access (and the immutable-data
        // rule), but this keeps the value intact across PATCHes that
        // omit it.
        if (operation === "create" && req.user) {
          data.createdBy = req.user.id
        }
        return data
      }
    ]
    // Intentionally no afterChange / afterDelete — see file header.
  }
}

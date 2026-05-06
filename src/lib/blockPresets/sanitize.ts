import type { Block, Field } from "payload"
import { blockBySlug } from "@/blocks/registry"

/**
 * Lazy schema-drift handler for block-preset insert.
 *
 * Given a stored preset's `data` object and the slug of the block-type the
 * preset claims to be for, walk the LIVE block field config and copy
 * through only the values whose key matches a known field. Unknown keys
 * are dropped silently — that's how we tolerate field renames or removals
 * across upstream block-config changes without a migration framework.
 *
 * What we deliberately do NOT do:
 *   - Inject defaults for newly-required fields. The user fills them in
 *     after insert; the page-save validator catches any that stay empty.
 *   - Rename old keys to new ones. There's no version stamp on stored
 *     presets, and bare-knuckle rename mapping invites footguns. Renames
 *     are operator-driven; if/when one happens, ship a one-shot
 *     `scripts/rewrite-preset-data.mjs`.
 *   - Validate referenced media IDs exist in the current tenant. Payload's
 *     own `upload` field validation fires on the next page save and
 *     surfaces broken refs there, which is cheaper than a per-insert
 *     tenant-media query.
 *
 * Recursion targets the same field shapes used in `src/blocks/*.ts`:
 *  - `group`     -> object subtree
 *  - `array`     -> array of row objects (each row's shape mirrors the
 *                   field's `fields`)
 *  - `blocks`    -> array of objects keyed by `blockType`; we recurse
 *                   into the matching sub-block's `fields`
 *  - `row`       -> presentational wrapper, no key in data — flatten
 *  - `collapsible` -> presentational wrapper, no key in data — flatten
 *
 * Anything else (text, textarea, number, select, upload, relationship,
 * checkbox, date, json, code, richText, email) is a leaf — copy through.
 *
 * Pure, no side effects, no React. Safe to import on the client (block
 * configs are plain JS).
 */
export function sanitizePresetData(blockSlug: string, data: unknown): Record<string, unknown> {
  const cfg = blockBySlug[blockSlug]
  if (!cfg) return {}
  if (data == null || typeof data !== "object") return {}
  return sanitizeAgainstFields(cfg.fields as Field[], data as Record<string, unknown>)
}

function sanitizeAgainstFields(
  fields: Field[],
  data: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of fields) {
    sanitizeField(field, data, out)
  }
  return out
}

function sanitizeField(
  field: Field,
  data: Record<string, unknown>,
  out: Record<string, unknown>
): void {
  // Presentational wrappers don't appear as keys in `data`; their nested
  // fields sit at the same level as their siblings, so we descend with
  // the same data + out objects.
  if (field.type === "row" || field.type === "collapsible") {
    if ("fields" in field) {
      for (const sub of field.fields) sanitizeField(sub, data, out)
    }
    return
  }

  // Tabs is theoretically supported by Payload but unused in our blocks
  // today. Skip silently rather than swallow data we can't validate.
  if (field.type === "tabs") return

  // Every remaining field type we render has a `name`. Skip anything
  // without one (defensive — covers `ui` and other anomalies).
  if (!("name" in field) || !field.name) return
  const name = field.name
  if (!(name in data)) return
  const value = data[name]

  if (field.type === "group") {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[name] = sanitizeAgainstFields(field.fields, value as Record<string, unknown>)
    }
    return
  }

  if (field.type === "array") {
    if (Array.isArray(value)) {
      out[name] = value
        .filter((row): row is Record<string, unknown> => row != null && typeof row === "object")
        .map((row) => sanitizeAgainstFields(field.fields, row))
    }
    return
  }

  if (field.type === "blocks") {
    if (Array.isArray(value)) {
      const allowed = new Set((field.blocks as Block[]).map((b) => b.slug))
      out[name] = value
        .filter(
          (row): row is Record<string, unknown> & { blockType: string } =>
            row != null &&
            typeof row === "object" &&
            typeof (row as Record<string, unknown>).blockType === "string" &&
            allowed.has((row as { blockType: string }).blockType)
        )
        .map((row) => {
          const sub = (field.blocks as Block[]).find((b) => b.slug === row.blockType)!
          return {
            blockType: row.blockType,
            ...sanitizeAgainstFields(sub.fields as Field[], row)
          }
        })
    }
    return
  }

  // Leaf — copy through verbatim. Any type-shape mismatch (e.g. a number
  // stored where a string is now expected) surfaces at page-save time
  // via the existing validators.
  out[name] = value
}

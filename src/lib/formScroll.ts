/**
 * Scroll to (and focus) the first invalid form field.
 *
 * Designed to plug into react-hook-form: pass either
 * `form.formState.errors` directly, or the `errors` argument that RHF
 * hands the `onInvalid` callback of `handleSubmit(onSubmit, onInvalid)`.
 *
 * RHF's error object is recursive: `errors.seo.title` is `{message,
 * type, ref}`, NOT `errors["seo.title"]`. A naive `Object.keys()[0]`
 * pick yields the parent group key (`"seo"`), whose CSS selector
 * `[name="seo"]` won't match anything. We walk the tree and assemble
 * the dotted path of the first leaf instead.
 *
 * Lookup order for the resolved path:
 *  1. `[name="<dotted-path>"]` — standard RHF + shadcn FormField wires
 *     `name` onto the underlying input/textarea/select.
 *  2. `[data-field-name="<dotted-path>"]` — escape hatch for custom
 *     widgets (e.g. MediaPicker) that don't render a real `name`
 *     attribute. Add the attribute to the wrapper to opt in.
 *
 * If nothing matches, the helper is a no-op — better than scrolling
 * to the wrong place.
 */
export function scrollToFirstError(errors: Record<string, unknown>): void {
  if (typeof document === "undefined") return

  const path = firstErrorPath(errors)
  if (!path) return

  // Escape characters that have meaning in CSS attribute selectors.
  // (`.` and `[` and `]` are valid inside a quoted attribute value, so
  // RHF's dotted paths and bracketed array paths both work as-is — only
  // quotes and backslashes need escaping.)
  const safe = path.replace(/(["\\])/g, "\\$1")
  let el = document.querySelector(`[name="${safe}"]`) as HTMLElement | null
  if (!el) {
    el = document.querySelector(`[data-field-name="${safe}"]`) as HTMLElement | null
  }
  if (!el) return

  el.scrollIntoView({ behavior: "smooth", block: "center" })
  // preventScroll keeps the smooth scroll-into-view from being
  // interrupted by the focus call snapping the viewport.
  if (typeof (el as HTMLElement).focus === "function") {
    ;(el as HTMLElement).focus({ preventScroll: true })
  }
}

/**
 * Recursively walk RHF's error object and return the dotted path of
 * the first leaf error encountered. RHF leaves have a `ref`, `type`,
 * or `message` property; intermediate nodes (group/array errors) are
 * plain nested objects keyed by sub-field name.
 */
function firstErrorPath(node: unknown, prefix = ""): string | undefined {
  if (!node || typeof node !== "object") return undefined
  for (const key of Object.keys(node as Record<string, unknown>)) {
    const v = (node as Record<string, unknown>)[key]
    if (!v) continue
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof v === "object" && v !== null) {
      // RHF leaves are objects with at least one of these properties.
      const o = v as Record<string, unknown>
      if (o.message !== undefined || o.type !== undefined || o.ref !== undefined) {
        return path
      }
      // Intermediate node — recurse.
      const nested = firstErrorPath(v, path)
      if (nested) return nested
    }
  }
  return undefined
}

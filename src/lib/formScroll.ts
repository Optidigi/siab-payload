/**
 * Scroll to (and focus) the first invalid form field.
 *
 * Designed to plug into react-hook-form: pass either
 * `form.formState.errors` directly, or the `errors` argument that RHF
 * hands the `onInvalid` callback of `handleSubmit(onSubmit, onInvalid)`.
 *
 * Lookup order:
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
  const keys = Object.keys(errors)
  const firstKey = keys[0]
  if (!firstKey) return

  if (typeof document === "undefined") return

  // Escape characters that have meaning in CSS attribute selectors.
  const safe = firstKey.replace(/(["\\])/g, "\\$1")
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

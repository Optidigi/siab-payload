// Audit-p2 #9 (T5) — Login post-auth open redirect.
//
// LoginForm reads `?next=` and feeds it to `router.replace`. Without
// validation, a phisher who lures a victim to
// `https://admin.<tenant>/login?next=//evil.example/clone` lands them on
// the attacker's origin after legitimate sign-in. Browsers treat
// protocol-relative URLs (`//host/path`) as cross-origin (same scheme as
// current page), so the History-API navigation that `router.replace`
// emits will follow it.
//
// Guard shape (per audit's literal Suggested fix):
//   - must be a string AND non-empty
//   - must startsWith("/") (relative URL)
//   - must NOT startsWith("//") (rejects protocol-relative)
//   - must NOT contain `\` (some URL parsers normalize `\` to `/`,
//     turning `/\evil.example` into `//evil.example`)
//   - must NOT contain control characters (CR/LF/NUL/etc.) — header /
//     URL splitting defense-in-depth
//
// Anything else collapses to `/` (admin home). Pure function so it
// composes with both the LoginForm client component and any future
// server-side redirect surface.
export function validateNextRedirect(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "/"

  // The raw string MUST start with a single `/` (not two, not encoded).
  // We deliberately do NOT trim or decode before checking — a leading
  // space, encoded `%2F`, or backslash should reject, not be normalised.
  if (!value.startsWith("/")) return "/"
  if (value.startsWith("//")) return "/"

  // `\` is treated as `/` by some browsers / URL parsers during
  // navigation. `/\evil.example` could be interpreted as
  // `//evil.example`. Reject any backslash anywhere in the string.
  if (value.includes("\\")) return "/"

  // Control characters (codepoint < 0x20, plus 0x7F DEL) can split URLs
  // in some parsers (e.g. CR+LF could terminate a Location header) and
  // are never valid inside a route literal the admin would use.
  if (/[\x00-\x1f\x7f]/.test(value)) return "/"

  return value
}

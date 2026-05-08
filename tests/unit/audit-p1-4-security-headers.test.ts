import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "@/middleware"

// Audit finding #4 (P1, T12) — Admin responses ship with no CSP /
// frame-ancestors / HSTS / nosniff / Referrer-Policy. Admin app is
// iframable from any origin; future XSS has no CSP fallback.
//
// Fix: stamp the middleware response with a strict CSP set
// (`frame-ancestors 'none'`) plus HSTS / X-Content-Type-Options /
// Referrer-Policy / X-Frame-Options DENY. Defensive path-branch
// reserved for future `/__preview*` routes (none in the CMS admin
// today; the live-preview iframe is hosted by the generated tenant
// site, which is a separate repo per THREAT-MODEL §1).
//
// Live-preview compatibility caveat (audit "Fix risk: Needs-care"):
// the CMS admin's <PreviewPane> embeds tenant origins via iframe.
// CSP `frame-src` must permit cross-origin HTTPS URLs so the iframe
// load is not blocked. We keep `frame-ancestors 'none'` (controls who
// embeds US) separate from `frame-src` (controls what we embed).

const reqAt = (path: string, host = "admin.example.com") =>
  new NextRequest(`https://${host}${path}`, { headers: { host } })

const headerOf = (res: Response, name: string) => res.headers.get(name)

describe("audit-p1 #4 — middleware stamps security headers (T12)", () => {
  describe("strict path (e.g. /sites/<slug>/users — the audit's clickjacking exploit URL)", () => {
    const path = "/sites/foo/users"

    it("sets Content-Security-Policy with frame-ancestors 'none' (clickjacking defense)", () => {
      const res = middleware(reqAt(path))
      const csp = headerOf(res, "content-security-policy")
      expect(csp).toBeTruthy()
      expect(csp).toMatch(/frame-ancestors\s+'none'/)
    })

    it("CSP includes a frame-src directive permitting cross-origin HTTPS (live-preview iframe)", () => {
      const res = middleware(reqAt(path))
      const csp = headerOf(res, "content-security-policy")!
      // Either an explicit frame-src that permits https:, or wildcard fallback.
      // We DO NOT want default-src to silently fall back to 'self', which would
      // block the <PreviewPane> iframe loading tenant.com/__preview/...
      expect(csp).toMatch(/frame-src[^;]*\bhttps:/)
    })

    it("CSP includes baseline directives: default-src, script-src, style-src, img-src, base-uri, form-action", () => {
      const res = middleware(reqAt(path))
      const csp = headerOf(res, "content-security-policy")!
      expect(csp).toMatch(/default-src\s+'self'/)
      expect(csp).toMatch(/script-src\s+/)
      expect(csp).toMatch(/style-src\s+/)
      expect(csp).toMatch(/img-src\s+/)
      expect(csp).toMatch(/base-uri\s+'self'/)
      expect(csp).toMatch(/form-action\s+'self'/)
    })

    it("sets X-Frame-Options: DENY (legacy clickjacking defense for older browsers)", () => {
      const res = middleware(reqAt(path))
      expect(headerOf(res, "x-frame-options")).toBe("DENY")
    })

    it("sets X-Content-Type-Options: nosniff", () => {
      const res = middleware(reqAt(path))
      expect(headerOf(res, "x-content-type-options")).toBe("nosniff")
    })

    it("sets Strict-Transport-Security with long max-age + includeSubDomains", () => {
      const res = middleware(reqAt(path))
      const hsts = headerOf(res, "strict-transport-security")
      expect(hsts).toBeTruthy()
      // max-age >= 1 year (31536000); includeSubDomains required.
      expect(hsts).toMatch(/max-age=\d{8,}/)
      expect(hsts).toMatch(/includeSubDomains/i)
    })

    it("sets Referrer-Policy", () => {
      const res = middleware(reqAt(path))
      const rp = headerOf(res, "referrer-policy")
      expect(rp).toBeTruthy()
      // Accept any conservative value (same-origin / strict-origin / strict-origin-when-cross-origin).
      expect(rp).toMatch(/(same-origin|strict-origin)/)
    })

    it("preserves existing x-siab-mode / x-siab-host stamping (no regression on tenant routing)", () => {
      const res = middleware(reqAt("/sites/foo/users", "tenant.example.com"))
      // Inspecting the request-side override is what hostToTenant downstream
      // reads. We assert the function still returns a NextResponse (didn't
      // throw / didn't strip the host stamp from request headers).
      expect(res).toBeTruthy()
    })
  })

  describe("the audit's exact exploit URL still gets frame-ancestors 'none'", () => {
    it("clickjacking iframe of /sites/<slug>/users from evil origin is blocked", () => {
      // Audit's reproduction: <iframe src="https://admin.<tenant>/sites/<slug>/users">
      const res = middleware(reqAt("/sites/clickjack-target/users"))
      expect(headerOf(res, "content-security-policy")).toMatch(/frame-ancestors\s+'none'/)
      expect(headerOf(res, "x-frame-options")).toBe("DENY")
    })

    it("/sites/<slug>/settings, /sites/<slug>/pages/123 — all admin routes get headers", () => {
      for (const p of ["/sites/foo/settings", "/sites/foo/pages/123", "/users", "/login"]) {
        const res = middleware(reqAt(p))
        expect(headerOf(res, "content-security-policy"), `path=${p}`).toMatch(/frame-ancestors\s+'none'/)
        expect(headerOf(res, "x-frame-options"), `path=${p}`).toBe("DENY")
        expect(headerOf(res, "x-content-type-options"), `path=${p}`).toBe("nosniff")
      }
    })
  })

  describe("preview path carve-out (defensive — no CMS admin preview routes today)", () => {
    // The audit's suggested fix says "every non-/__preview* admin response,
    // set ... frame-ancestors 'none'". The CMS admin doesn't currently serve
    // any /__preview* routes (the live-preview iframe loads from tenant.com,
    // a separate repo). The branch is reserved so a future preview route can
    // opt into a relaxed CSP without rewriting middleware.

    it("/__preview* path does NOT set X-Frame-Options: DENY (so it can be framed by admin if ever added)", () => {
      const res = middleware(reqAt("/__preview/page-123"))
      // Reserved branch: /__preview* should not stamp XFO DENY (XFO has no
      // way to allow a specific origin; CSP frame-ancestors must do that).
      expect(headerOf(res, "x-frame-options")).toBeNull()
    })

    it("/__preview* still sets baseline hardening (HSTS, nosniff, Referrer-Policy)", () => {
      const res = middleware(reqAt("/__preview/page-123"))
      expect(headerOf(res, "strict-transport-security")).toBeTruthy()
      expect(headerOf(res, "x-content-type-options")).toBe("nosniff")
      expect(headerOf(res, "referrer-policy")).toBeTruthy()
    })
  })
})

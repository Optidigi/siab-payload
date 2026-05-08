import { NextRequest, NextResponse } from "next/server"
import { stripAdminPrefix, isSuperAdminDomain } from "@/lib/hostToTenant"

// Pass-through for everything that isn't an authenticated app route.
// Specifically skip:
//   /_next/*  — Next.js asset pipeline
//   /api/*    — Payload's REST/GraphQL endpoints (they have their own auth)
//   /admin/*  — Payload's native admin (still mounted in Phase 0; disabled in Phase 5)
//   favicon.ico, robots.txt, etc.
//
// The (frontend) route group's pages (/, /login, /sites/*, etc.) all match
// the matcher below and receive the stamped headers.

// Audit-p1 #4 (T12): security-header set applied on every middleware-matched
// response. CSP composition:
//   - default-src 'self'           — same-origin baseline
//   - script-src adds 'unsafe-inline' 'unsafe-eval' — Next.js App Router
//     emits inline hydration scripts and runtime-eval'd chunks; tightening
//     to nonces is tracked as a follow-up. Documented deviation from the
//     audit's strawman CSP.
//   - style-src 'unsafe-inline'    — needed by Tailwind / Emotion-style runtime CSS
//   - img-src https: data:         — admin renders tenant uploads + base64 thumbs
//   - font-src 'self' data:        — admin self-hosts fonts
//   - connect-src 'self'           — same-origin fetch only (admin → /api/*)
//   - frame-src 'self' https:      — REQUIRED for live-preview <iframe> embedding
//                                    tenant origins (`<PreviewPane>`). Without
//                                    this, default-src falls back and blocks the
//                                    cross-origin iframe load.
//   - frame-ancestors 'none'       — primary fix; blocks clickjacking on admin
//   - base-uri 'self'              — block <base> override
//   - form-action 'self'           — block form-redirect to attacker origin
const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

// Reserved for future CMS-admin preview routes (none today). The CMS admin
// is the EMBEDDER of preview iframes, not the EMBEDDED — the iframe loads
// from tenant.com, which is a separate repo (THREAT-MODEL §1) with its own
// path-branched middleware (see docs/superpowers/plans/2026-05-06-live-
// preview-plan.md:618-660). If the CMS admin ever adds a /__preview* route
// that should be frameable by admin, this branch lets it skip XFO DENY
// without changing the rest of the hardening set.
const PREVIEW_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  // No frame-ancestors here — the route may be framed by admin. Add a
  // specific origin (e.g. ADMIN_ORIGIN env) when a real preview route lands.
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

const HSTS = "max-age=63072000; includeSubDomains; preload"

const isPreviewPath = (p: string): boolean =>
  p === "/__preview" || p.startsWith("/__preview/")

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || ""
  const domain = stripAdminPrefix(host)
  const superAdminDomain = process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN

  const headers = new Headers(req.headers)
  if (isSuperAdminDomain(domain, superAdminDomain)) {
    headers.set("x-siab-mode", "super-admin")
    headers.set("x-siab-host", "")
  } else {
    headers.set("x-siab-mode", "tenant")
    headers.set("x-siab-host", domain)
  }

  const res = NextResponse.next({ request: { headers } })

  const previewPath = isPreviewPath(req.nextUrl.pathname)
  res.headers.set("Content-Security-Policy", previewPath ? PREVIEW_CSP : ADMIN_CSP)
  res.headers.set("Strict-Transport-Security", HSTS)
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  if (!previewPath) {
    res.headers.set("X-Frame-Options", "DENY")
  }

  return res
}

export const config = {
  matcher: [
    // Match everything EXCEPT:
    //   - Payload API + admin (handled by their own routes)
    //   - Next.js internals
    //   - common static asset paths
    //
    // The trailing `/` after `api` and `admin` is intentional — without it,
    // `api-key` and any future `admin-*` route would be incorrectly excluded
    // (the negative lookahead would match the `api` prefix in `api-key`).
    "/((?!api/|admin/|_next/static|_next/image|favicon.ico|robots.txt|llms.txt).*)"
  ]
}

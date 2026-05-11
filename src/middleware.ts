import { NextRequest, NextResponse } from "next/server"
import { RateLimiterMemory } from "rate-limiter-flexible"
import { stripAdminPrefix, isSuperAdminDomain } from "@/lib/hostToTenant"

// Pass-through for everything that isn't an authenticated app route.
// Specifically skip:
//   /_next/*  — Next.js asset pipeline
//   /admin/*  — Payload's native admin (still mounted in Phase 0; disabled in Phase 5)
//   favicon.ico, robots.txt, etc.
//
// Most of /api/* is excluded (Payload's REST/GraphQL endpoints have their
// own auth), with two opt-in exceptions for audit-p1 #5 (T4) rate-limit:
// /api/forms and /api/users/forgot-password are anonymous public surfaces
// whose abuse-by-flood vector the matcher MUST route through middleware.
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
// from tenant.com (a separate repo). If the CMS admin ever adds a /__preview*
// route that should be frameable by admin, this branch lets it skip XFO DENY
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

// Stamp the audit-p1 #4 security-header set onto a response. Centralised so
// the rate-limit branch's 429 path and the regular pass-through path both
// emit the same set; future changes (CSP nonces, etc.) land in one place.
const applySecurityHeaders = (res: NextResponse, pathname: string): NextResponse => {
  const previewPath = isPreviewPath(pathname)
  res.headers.set("Content-Security-Policy", previewPath ? PREVIEW_CSP : ADMIN_CSP)
  res.headers.set("Strict-Transport-Security", HSTS)
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  if (!previewPath) {
    res.headers.set("X-Frame-Options", "DENY")
  }
  return res
}

// -----------------------------------------------------------------------------
// Audit-p1 #5 (T4) — rate-limit on public POST surfaces
// -----------------------------------------------------------------------------
//
// Library: `rate-limiter-flexible` (RateLimiterMemory). In-memory, no Redis
// dep — appropriate for the single-instance VPS deployment. If/when this
// fans out to multiple Node processes or hosts, swap to RateLimiterCluster
// or a Redis-backed limiter. (Documented in audits/07-fix-batch-6-report.md.)
//
// Scope (per dispatch Constraint 2): /api/forms and /api/users/forgot-password
// ONLY. POST method only. /api/users (bootstrap surface) is INTENTIONALLY
// out-of-scope; rate-limiting it would interfere with the P1 #6 BOOTSTRAP_TOKEN
// seed runbook + AMD-1 owner-invite flow.
//
// Anonymous detection (per dispatch Constraint 1, approach (b)): a caller
// is "anonymous" iff BOTH the `Authorization` header is absent AND no
// `payload-token` cookie is present. Authed callers (super-admin via
// orchestrator apiKey, or any logged-in user via session cookie) bypass
// the limiter — preserves the orchestrator-friendliness invariant from
// AMD-1 (orchestrator bursts /api/users/forgot-password during tenant
// provisioning Phase 8). The residual gap (authed editor floods forgot-
// password with arbitrary emails) is recorded as out-of-batch observation
// in the batch report; closing it is a future-audit item.
//
// Identifier: leftmost IP from `X-Forwarded-For` (the VPS sits behind nginx-
// proxy-manager, which sets this header per the audit's deployment notes;
// RFC 7239 best practice is leftmost = original client). Fallback `"unknown"`
// shares one bucket across all spoofed/missing-XFF callers — the worst case
// is that all such callers compete for one 10/min budget, which is the
// correct conservative behaviour. Spoofing IP via the XFF header to bypass
// the limit lands a different attacker IP in the bucket per request, which
// IS a real bypass — but THREAT-MODEL §5 places network-layer DoS out-of-
// scope; the in-app limiter raises the cost-of-attack from one machine to
// distributed-bot territory. Documented in batch report.
//
// Limits: 10 / 60 seconds per (path, ip). Aligns with the audit's literal
// suggestion ("10/min/IP/route"). Budget is per-route — a flooder hitting
// /api/forms doesn't cost the /api/users/forgot-password budget for the
// same IP. Path normalization strips trailing slashes so `/api/forms` and
// `/api/forms/` share one budget (Test Case 5).

const RATE_LIMIT_POINTS = 10
const RATE_LIMIT_DURATION_SECONDS = 60

// Single shared limiter instance per process. The composite key
// `${normalizedPath}:${ip}` provides per-(path,ip) isolation. We don't
// pre-allocate per-route limiters because the set of rate-limited routes
// is small and may grow (e.g. /api/health, future contact-v2 endpoints);
// keying on path keeps the wiring uniform.
let rateLimiter: RateLimiterMemory | null = null

const getRateLimiter = (): RateLimiterMemory => {
  if (rateLimiter == null) {
    rateLimiter = new RateLimiterMemory({
      points: RATE_LIMIT_POINTS,
      duration: RATE_LIMIT_DURATION_SECONDS,
    })
  }
  return rateLimiter
}

// Test-only export: drop limiter state between tests so per-IP budgets
// don't leak across test cases. NOT called from production code; the
// underscore-prefixed name is the convention for `import-but-do-not-call`.
export const __resetRateLimitersForTests = (): void => {
  rateLimiter = null
}

const RATE_LIMITED_PATHS = new Set<string>([
  "/api/forms",
  "/api/users/forgot-password",
])

const normalizePath = (p: string): string => {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1)
  return p
}

const isRateLimitedRequest = (req: NextRequest): boolean => {
  if (req.method !== "POST") return false
  return RATE_LIMITED_PATHS.has(normalizePath(req.nextUrl.pathname))
}

// Anonymous = no Authorization header AND no payload-token cookie. Either
// signal flips the caller to "authed-or-trusted" and the limiter skips.
const isAnonymousCaller = (req: NextRequest): boolean => {
  if (req.headers.get("authorization")) return false
  // NextRequest exposes parsed cookies via the cookies() helper in the
  // edge runtime; fall back to a manual cookie-header parse for unit-test
  // shapes that don't materialise the cookie store.
  const tokenCookie = req.cookies.get("payload-token")
  if (tokenCookie?.value) return false
  return true
}

// Leftmost IP from X-Forwarded-For. The VPS deployment terminates TLS at
// nginx-proxy-manager which appends client IPs in chain order
// (RFC 7239 §5.2); `203.0.113.10, 10.0.0.5` → take `203.0.113.10`. Empty
// or missing header → `"unknown"` (one shared bucket across such callers).
const extractClientIp = (req: NextRequest): string => {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  // NextRequest exposes `ip` in the edge runtime when a trusted proxy is
  // configured; fall back to it where present, else "unknown".
  const ip = (req as unknown as { ip?: string }).ip
  if (ip) return ip
  return "unknown"
}

const buildRateLimitedResponse = (msBeforeNext: number, pathname: string): NextResponse => {
  const retryAfterSeconds = Math.max(1, Math.ceil(msBeforeNext / 1000))
  const res = NextResponse.json(
    { error: `Too many requests, retry in ${retryAfterSeconds} seconds` },
    { status: 429 }
  )
  res.headers.set("Retry-After", String(retryAfterSeconds))
  // Also stamp the audit-p1 #4 security headers — the 429 page is a
  // middleware-matched response, so the same hardening contract applies.
  return applySecurityHeaders(res, pathname)
}

// -----------------------------------------------------------------------------
// Middleware entry point
// -----------------------------------------------------------------------------

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const host = req.headers.get("host") || ""
  const domain = stripAdminPrefix(host)
  const superAdminDomain = process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN

  // Rate-limit short-circuit: gate ONLY when the request is in scope
  // (POST + named path + anonymous caller). Authenticated callers and
  // out-of-scope paths fall through to the unchanged headers-stamping
  // path below.
  if (isRateLimitedRequest(req) && isAnonymousCaller(req)) {
    const limiter = getRateLimiter()
    const ip = extractClientIp(req)
    const key = `${normalizePath(req.nextUrl.pathname)}:${ip}`
    try {
      await limiter.consume(key, 1)
    } catch (rejRes) {
      // RateLimiterRes shape: {msBeforeNext: number, ...}
      const ms =
        typeof rejRes === "object" && rejRes && "msBeforeNext" in rejRes
          ? Number((rejRes as { msBeforeNext: unknown }).msBeforeNext)
          : RATE_LIMIT_DURATION_SECONDS * 1000
      return buildRateLimitedResponse(
        Number.isFinite(ms) ? ms : RATE_LIMIT_DURATION_SECONDS * 1000,
        req.nextUrl.pathname
      )
    }
  }

  const headers = new Headers(req.headers)
  if (isSuperAdminDomain(domain, superAdminDomain)) {
    headers.set("x-siab-mode", "super-admin")
    headers.set("x-siab-host", "")
  } else {
    headers.set("x-siab-mode", "tenant")
    headers.set("x-siab-host", domain)
  }

  const res = NextResponse.next({ request: { headers } })
  return applySecurityHeaders(res, req.nextUrl.pathname)
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
    "/((?!api/|admin/|_next/static|_next/image|favicon.ico|robots.txt|llms.txt).*)",
    // audit-p1 #5 (T4): opt the two anti-flood public surfaces back IN to
    // middleware so the rate-limit gate runs on them. Trailing-slash variants
    // are explicit so the matcher itself doesn't depend on Next.js' implicit
    // trailing-slash handling (which differs between dev / prod / nginx).
    "/api/forms",
    "/api/forms/",
    "/api/users/forgot-password",
    "/api/users/forgot-password/",
  ]
}

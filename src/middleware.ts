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

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: [
    // Match everything EXCEPT:
    //   - Payload API + admin (handled by their own routes)
    //   - Next.js internals
    //   - common static asset paths
    "/((?!api|admin|_next/static|_next/image|favicon.ico|robots.txt|llms.txt).*)"
  ]
}

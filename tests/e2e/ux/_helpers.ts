import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Page } from "@playwright/test"

/**
 * UX test helpers — separate from `tests/e2e/_setup.ts` because the orchestrator
 * API-key seeding path that file uses doesn't exist in the workspace bootstrap.
 *
 * Auth strategy: each UX spec logs in once at the top via the real /login form
 * (so the audit's discovery that login itself works survives in CI). Reuses the
 * super-admin credentials saved by the workspace's Phase 0 bootstrap at
 * `frontend-auditer/.local-creds.json` (or env vars if set).
 */

type Creds = { email: string; password: string }

function readWorkspaceCreds(): Creds | null {
  // Playwright runs from siab-payload/, so the workspace root is one level up.
  const path = resolve(process.cwd(), "..", ".local-creds.json")
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      super_admin?: Creds
    }
    if (raw.super_admin?.email && raw.super_admin?.password) {
      return { email: raw.super_admin.email, password: raw.super_admin.password }
    }
  } catch {
    // file missing / malformed → caller falls back
  }
  return null
}

export function getSuperAdminCreds(): Creds {
  const envEmail = process.env.UX_TEST_SA_EMAIL
  const envPw = process.env.UX_TEST_SA_PASSWORD
  if (envEmail && envPw) return { email: envEmail, password: envPw }
  const fromFile = readWorkspaceCreds()
  if (fromFile) return fromFile
  throw new Error(
    "UX tests need super-admin credentials. Either set UX_TEST_SA_EMAIL + UX_TEST_SA_PASSWORD, " +
      "or run `frontend-auditer`'s Phase 0 bootstrap to populate ../.local-creds.json."
  )
}

export async function loginAsSuperAdmin(page: Page): Promise<void> {
  const creds = getSuperAdminCreds()
  await page.goto("/login")
  await page.fill('input[type="email"]', creds.email)
  await page.fill('input[type="password"]', creds.password)
  await page.click('button:has-text("Sign in")')
  await page.waitForURL("/", { timeout: 30_000 })
}

/**
 * Canonical list of admin routes walked by the audit pass. Used by sweep specs
 * (e.g. document-title.spec.ts). Each entry's slug must exist in the seeded
 * tenant — the workspace bootstrap creates `audit-test`.
 */
export const ADMIN_ROUTES_AUTHENTICATED: ReadonlyArray<{ url: string; label: string }> = [
  { url: "/", label: "super-admin dashboard" },
  { url: "/sites", label: "sites list" },
  { url: "/sites/audit-test", label: "tenant dashboard" },
  { url: "/sites/audit-test/pages", label: "pages list" },
  { url: "/sites/audit-test/pages/1", label: "page editor" },
  { url: "/sites/audit-test/settings", label: "settings" },
  { url: "/sites/audit-test/onboarding", label: "onboarding" },
  { url: "/sites/audit-test/forms", label: "forms list" },
  { url: "/sites/audit-test/users", label: "team" },
  { url: "/sites/audit-test/media", label: "media" }
]

export const ADMIN_ROUTES_UNAUTHENTICATED: ReadonlyArray<{ url: string; label: string }> = [
  { url: "/login", label: "login" }
]

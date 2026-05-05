import { request, type APIRequestContext } from "@playwright/test"

const ORCH_KEY = "users API-Key 45ad6a4d-1307-4d66-a085-e525afbc3e6a"
const BASE = process.env.E2E_BASE_URL || "http://localhost:3001"

export async function ensureE2EUser(ctx?: APIRequestContext) {
  const ctxApi = ctx ?? (await request.newContext())
  // Check if the e2e super-admin exists
  const meRes = await ctxApi.get(`${BASE}/api/users?where[email][equals]=e2e-sa@test.local&limit=1`, {
    headers: { Authorization: ORCH_KEY }
  })
  const me = await meRes.json()
  if ((me.docs ?? []).length === 0) {
    const create = await ctxApi.post(`${BASE}/api/users`, {
      headers: { Authorization: ORCH_KEY, "Content-Type": "application/json" },
      data: { email: "e2e-sa@test.local", password: "e2e-test-1234", name: "E2E SA", role: "super-admin" }
    })
    if (!create.ok()) {
      // Tolerate races: if another worker created it concurrently, we'll see
      // a uniqueness violation. That's fine — the user exists.
      const body = await create.text()
      const isDup = body.includes("already registered") || body.includes("must be unique") || body.includes("Value must be unique")
      if (!isDup) throw new Error(`Failed to create E2E user: ${create.status()} ${body}`)
    }
  }
  if (!ctx) await ctxApi.dispose()
  return { email: "e2e-sa@test.local", password: "e2e-test-1234" }
}

export async function cleanupE2ETenant(slug: string, ctx?: APIRequestContext) {
  const ctxApi = ctx ?? (await request.newContext())
  const tres = await ctxApi.get(`${BASE}/api/tenants?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`, {
    headers: { Authorization: ORCH_KEY }
  })
  const t = await tres.json()
  const id = t.docs?.[0]?.id
  if (id) {
    // Cascade can be slow; allow up to 30s and don't fail the test if cleanup hiccups.
    try {
      await ctxApi.delete(`${BASE}/api/tenants/${id}`, {
        headers: { Authorization: ORCH_KEY },
        timeout: 30_000
      })
    } catch {
      // best-effort
    }
  }
  if (!ctx) await ctxApi.dispose()
}

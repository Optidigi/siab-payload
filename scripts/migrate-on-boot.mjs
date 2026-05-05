#!/usr/bin/env node
/**
 * UNBUNDLED reference / unit-test fixture twin of the production migration
 * script. The actual runtime entrypoint in the Docker image is the
 * esbuild-bundled `dist-runtime/migrate-on-boot.bundled.mjs` produced from
 * `scripts/migrate-on-boot-entry.ts` — this file does NOT run in production.
 *
 * It exists because `tests/unit/migrate-on-boot.test.ts` reads this file's
 * source, patches the `await import("payload")` call to point at an in-test
 * stub, and asserts the control flow (count diff → exit code). Keeping the
 * unbundled twin around is cheaper than wiring vitest to bundle the real
 * entry through esbuild in-process.
 *
 * If you change the control flow here, mirror the change in
 * `scripts/migrate-on-boot-entry.ts` (the production source).
 *
 * Exits 0 on success (including no-op when no migrations are pending).
 * Exits non-zero on any failure.
 */
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Resolve relative to this script, not cwd, so it works regardless of where
// the entrypoint chooses to chdir. Use a file:// URL so dynamic `import()`
// works on Windows too (Node refuses raw `c:\` paths via the ESM loader).
const configPath = pathToFileURL(
  path.resolve(__dirname, "..", "dist-runtime", "payload.config.mjs")
).href
const migrationDir = path.resolve(__dirname, "..", "dist-runtime", "migrations")

// Tell payload.config.ts where to find the runtime migrations. The config
// reads PAYLOAD_MIGRATION_DIR and forwards it into postgresAdapter().
process.env.PAYLOAD_MIGRATION_DIR = migrationDir
// Suppress optimisations the running app process triggers — we only want
// the DB adapter, not jobs/cron/etc.
process.env.PAYLOAD_DISABLE_ADMIN = "true"

/**
 * Return the count of rows in `payload_migrations`, or 0 if the table doesn't
 * exist yet (fresh DB). `payload.count` on a non-existent table throws
 * Postgres error 42P01, so we probe with `to_regclass` first.
 */
async function safeMigrationCount(payload) {
  const db = payload.db
  if (db && typeof db.execute === "function") {
    const prependSchema = db.schemaName ? `"${db.schemaName}".` : ""
    const res = await db.execute({
      drizzle: db.drizzle,
      raw: `SELECT to_regclass('${prependSchema}"payload_migrations"') AS exists;`
    })
    const [row] = res.rows ?? []
    const exists = row && typeof row === "object" && "exists" in row && !!row.exists
    if (!exists) return 0
  }
  const { totalDocs } = await payload.count({
    collection: "payload-migrations",
    overrideAccess: true
  })
  return totalDocs
}

const start = Date.now()

try {
  const { getPayload } = await import("payload")
  const configMod = await import(configPath)
  const config = configMod.default ?? configMod

  const payload = await getPayload({ config })

  // Capture how many migrations were applied. Payload's adapter.migrate()
  // doesn't return a count, so diff `payload-migrations` rows before/after.
  // On a fresh DB the table doesn't exist yet — probe via `to_regclass`
  // before counting, mirroring @payloadcms/drizzle's `migrationTableExists`.
  const beforeCount = await safeMigrationCount(payload)

  await payload.db.migrate()

  const after = await payload.count({
    collection: "payload-migrations",
    overrideAccess: true
  })

  const applied = Math.max(0, after.totalDocs - beforeCount)
  const ms = Date.now() - start
  if (applied === 0) {
    // eslint-disable-next-line no-console
    console.log(`[migrate-on-boot] no pending migrations (${ms}ms)`)
  } else {
    // eslint-disable-next-line no-console
    console.log(`[migrate-on-boot] ${applied} migration(s) applied (${ms}ms)`)
  }

  // Payload keeps the pg pool alive; close it so the script exits promptly.
  await payload.db.destroy?.()
  process.exit(0)
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("[migrate-on-boot] FAILED:", err)
  process.exit(1)
}

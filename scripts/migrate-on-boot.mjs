#!/usr/bin/env node
/**
 * Run any pending Payload migrations, then exit. Invoked by
 * `docker-entrypoint.sh` before `node server.js` so a fresh DB or a
 * post-deploy schema bump comes up healthy without operator intervention.
 *
 * Loads the pre-bundled config from `dist-runtime/payload.config.mjs`
 * (built in the Dockerfile's builder stage by
 * `scripts/build-runtime-bundle.mjs`) and points Payload at the bundled
 * migrations under `dist-runtime/migrations/`.
 *
 * Exits 0 on success (including no-op when no migrations are pending).
 * Exits non-zero on any failure so `docker compose up -d` surfaces the
 * problem in `docker logs` and the restart loop is visible.
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

const start = Date.now()

try {
  const { getPayload } = await import("payload")
  const configMod = await import(configPath)
  const config = configMod.default ?? configMod

  const payload = await getPayload({ config })

  // Capture how many migrations were applied. Payload's adapter.migrate()
  // doesn't return a count, so diff `payload-migrations` rows before/after.
  const before = await payload.count({
    collection: "payload-migrations",
    overrideAccess: true
  })

  await payload.db.migrate()

  const after = await payload.count({
    collection: "payload-migrations",
    overrideAccess: true
  })

  const applied = Math.max(0, after.totalDocs - before.totalDocs)
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

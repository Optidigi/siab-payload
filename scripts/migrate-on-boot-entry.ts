/**
 * Bundle entry-point for `dist-runtime/migrate-on-boot.bundled.mjs`.
 *
 * This is the file esbuild ingests in `scripts/build-runtime-bundle.mjs`.
 * It statically imports the Payload config AND the migrations array, so the
 * bundler can inline everything — payload, db-postgres, drizzle, pg, the
 * config, every migration's up/down — into a single self-contained `.mjs`
 * that runs in the Next.js standalone runner image (which does NOT preserve
 * `node_modules/payload` as an importable package).
 *
 * The unbundled twin at `scripts/migrate-on-boot.mjs` exists only as the
 * test harness's source-of-truth (imported by `tests/unit/migrate-on-boot.test.ts`
 * which patches `await import("payload")` with a stub). The two scripts
 * share the same control flow: read migration count, run, diff, exit.
 *
 * Why pass `migrations` directly to `payload.db.migrate()` instead of
 * `migrationDir`: the directory route forces Payload's `readMigrationFiles`
 * to `readdirSync()` + dynamic-`import()` each migration file at runtime,
 * which esbuild cannot bundle. Drizzle's adapter accepts an explicit
 * `migrations` arg on `migrate({ migrations })`, sidestepping the FS.
 */
import { getPayload } from "payload"

import { migrations } from "@/migrations"
import config from "@/payload.config"

// Suppress admin-only initialisation paths; we only need the DB adapter.
process.env.PAYLOAD_DISABLE_ADMIN = "true"

const start = Date.now()

try {
  const payload = await getPayload({ config })

  // Diff `payload-migrations` rows before/after to count what was applied,
  // since adapter.migrate() doesn't return a count.
  const before = await payload.count({
    collection: "payload-migrations",
    overrideAccess: true
  })

  // Pass the bundled migrations array explicitly — Drizzle's `migrate`
  // accepts `args.migrations` and uses it instead of scanning the
  // configured migrationDir. Cast: types/runtime mismatch (Payload's public
  // BaseDatabaseAdapter.migrate is loosely typed), runtime contract verified
  // in @payloadcms/drizzle/dist/migrate.js.
  await (payload.db.migrate as (args?: { migrations?: typeof migrations }) => Promise<void>)({
    migrations
  })

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

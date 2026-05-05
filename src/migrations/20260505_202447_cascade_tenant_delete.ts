import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Wave 2 — switch the four tenant-scoped collections AND `users_tenants`
 * from `ON DELETE SET NULL` to `ON DELETE CASCADE` on `tenant_id`.
 *
 * Why pages/media/site_settings/forms: with SET NULL, deleting a tenant
 * orphaned its content — rows kept living in the DB with `tenant_id = NULL`,
 * invisible to the tenant-scoped admin views and indistinguishable from
 * "no-tenant" rows. Track 1 prod smoke test exposed the leak.
 *
 * Why users_tenants: Wave 1's auto-generated migration created a contradictory
 * pair — the column was `NOT NULL` but the FK was `ON DELETE SET NULL`. So
 * any `DELETE FROM tenants` failed at the FK trigger ("null value in column
 * tenant_id violates not-null constraint") BEFORE the plugin's afterDelete
 * cleanup hook could run. CASCADE is the right semantic anyway: deleting a
 * tenant should remove every user-tenant association entry pointing at it.
 * The plugin's cleanup hook becomes a no-op for the users side after this
 * (its UPDATE-with-filter still runs but matches zero rows post-cascade).
 *
 * Cascade semantics are correct because every row in these tables is
 * conceptually owned by exactly one tenant. The only thing that intentionally
 * survives a tenant delete is the `users` row itself (super-admins exist
 * tenant-less; non-super-admins lose their tenants[] entry but the user
 * record itself stays so it can be re-assigned).
 *
 * Up:
 *   1. Drop the existing SET NULL FKs.
 *   2. Re-add as CASCADE.
 *
 * Down: the inverse — drop CASCADE, re-add SET NULL. Note that re-running
 * `down` restores the original Wave 1 mismatch on users_tenants; that's
 * faithful inverse but means the original tenant-delete bug returns.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // IF EXISTS on the DROPs lets the migration retry safely from a partially-
  // applied state (e.g. previous run crashed mid-batch).
  await db.execute(sql`
    ALTER TABLE "pages" DROP CONSTRAINT IF EXISTS "pages_tenant_id_tenants_id_fk";
    ALTER TABLE "pages" ADD CONSTRAINT "pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_tenant_id_tenants_id_fk";
    ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "site_settings" DROP CONSTRAINT IF EXISTS "site_settings_tenant_id_tenants_id_fk";
    ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "forms" DROP CONSTRAINT IF EXISTS "forms_tenant_id_tenants_id_fk";
    ALTER TABLE "forms" ADD CONSTRAINT "forms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "users_tenants" DROP CONSTRAINT IF EXISTS "users_tenants_tenant_id_tenants_id_fk";
    ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // This migration is intentionally NOT reversible. A naive "set null" inverse
  // on `users_tenants_tenant_id_tenants_id_fk` would re-arm the original Wave 1
  // bug: the column is declared NOT NULL while the FK action is SET NULL —
  // contradictory pair that makes every tenant DELETE fail at the FK trigger.
  // If you genuinely need to roll back to pre-cascade behaviour, you must
  // either (a) ALSO drop NOT NULL on users_tenants.tenant_id at the same time,
  // or (b) roll back further to before Wave 1's users_tenants migration. Both
  // require deliberate operator intervention, which is what this throw forces.
  throw new Error(
    "20260505_202447_cascade_tenant_delete: down is intentionally unsupported. " +
    "A faithful inverse re-arms the Wave 1 NOT-NULL/SET-NULL contradiction on " +
    "users_tenants.tenant_id (every tenant DELETE would fail). To roll back, " +
    "either drop NOT NULL on users_tenants.tenant_id manually first, or roll " +
    "back further to before the Wave 1 users_tenants migration."
  )
}

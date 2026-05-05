import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Wave 2 — switch the four tenant-scoped collections from
 * `ON DELETE SET NULL` to `ON DELETE CASCADE` on `tenant_id`.
 *
 * Why: with SET NULL, deleting a tenant orphaned its pages, media,
 * site_settings, and forms — they kept living in the DB with `tenant_id =
 * NULL`, invisible to the tenant-scoped admin views and indistinguishable
 * from "no-tenant" rows. Track 1 prod smoke test exposed the leak.
 *
 * Cascade semantics here are correct because every row in those tables is
 * conceptually owned by exactly one tenant — there is no shared / global
 * data sitting in `pages` etc. The only collection that intentionally
 * survives a tenant delete is `users` (super-admins exist tenant-less),
 * and we keep `users.tenants[]` as SET NULL via the plugin's
 * `cleanupAfterTenantDelete` hook (re-enabled in a follow-up commit).
 *
 * Up:
 *   1. Drop the existing SET NULL FKs on pages/media/site_settings/forms.
 *   2. Re-add as CASCADE.
 *
 * Down: the inverse — drop CASCADE, re-add SET NULL.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages" DROP CONSTRAINT "pages_tenant_id_tenants_id_fk";
    ALTER TABLE "pages" ADD CONSTRAINT "pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "media" DROP CONSTRAINT "media_tenant_id_tenants_id_fk";
    ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_tenant_id_tenants_id_fk";
    ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "forms" DROP CONSTRAINT "forms_tenant_id_tenants_id_fk";
    ALTER TABLE "forms" ADD CONSTRAINT "forms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages" DROP CONSTRAINT "pages_tenant_id_tenants_id_fk";
    ALTER TABLE "pages" ADD CONSTRAINT "pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;

    ALTER TABLE "media" DROP CONSTRAINT "media_tenant_id_tenants_id_fk";
    ALTER TABLE "media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;

    ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_tenant_id_tenants_id_fk";
    ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;

    ALTER TABLE "forms" DROP CONSTRAINT "forms_tenant_id_tenants_id_fk";
    ALTER TABLE "forms" ADD CONSTRAINT "forms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  `)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Wave 1 — switch Users from a singular `tenant` relationship to the
 * plugin-multi-tenant native `tenants[]` array shape. The plugin's access
 * wrappers and base filter look up users via `tenants.tenant`, so the
 * singular field caused 403s on every scoped collection for non-super-admin
 * users.
 *
 * Up:
 *   1. Create the `users_tenants` array table (per Payload's array-field
 *      convention: _order, _parent_id, id, tenant_id).
 *   2. Backfill from the existing `users.tenant_id` column for every user
 *      where it's set (a single row per user, _order = 1).
 *   3. Drop the old `users_tenant_id_tenants_id_fk` FK + `users_tenant_idx`
 *      index, then drop the `users.tenant_id` column.
 *
 * Down:
 *   1. Re-add `users.tenant_id` + FK + index.
 *   2. Backfill `users.tenant_id` from `users_tenants` (taking the first row
 *      per parent — by `_order` then `id` for determinism).
 *   3. Drop the `users_tenants` table.
 *
 * Concurrency: the three `db.execute` calls below run inside Payload's
 * implicit per-migration transaction (db-postgres wraps each migration), so
 * a concurrent write to `users.tenant_id` between the backfill INSERT and
 * the column DROP cannot leak data. Still: run during a quiet window.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // 1. Create the array table + indexes + FKs.
  await db.execute(sql`
    CREATE TABLE "users_tenants" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "tenant_id" integer NOT NULL
    );

    ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "users_tenants" ADD CONSTRAINT "users_tenants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "users_tenants_order_idx" ON "users_tenants" USING btree ("_order");
    CREATE INDEX "users_tenants_parent_id_idx" ON "users_tenants" USING btree ("_parent_id");
    CREATE INDEX "users_tenants_tenant_idx" ON "users_tenants" USING btree ("tenant_id");
  `)

  // 2. Backfill from the legacy singular column. We do this BEFORE dropping
  //    the column so existing non-super-admin users keep their tenant after
  //    the migration. gen_random_uuid() is built into Postgres 13+; no
  //    extension required.
  await db.execute(sql`
    INSERT INTO "users_tenants" ("_order", "_parent_id", "tenant_id", "id")
    SELECT 1, "id", "tenant_id", gen_random_uuid()::text
    FROM "users"
    WHERE "tenant_id" IS NOT NULL;
  `)

  // 3. Drop the legacy FK, index, and column.
  await db.execute(sql`
    ALTER TABLE "users" DROP CONSTRAINT "users_tenant_id_tenants_id_fk";
    DROP INDEX "users_tenant_idx";
    ALTER TABLE "users" DROP COLUMN "tenant_id";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // 1. Re-add the legacy column + FK + index.
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN "tenant_id" integer;
    ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");
  `)

  // 2. Backfill from users_tenants — the row with the smallest (_order, id)
  //    per parent wins. Our domain invariant guarantees length <= 1 for
  //    non-super-admins, so this is unambiguous in practice.
  await db.execute(sql`
    UPDATE "users" u
    SET "tenant_id" = sub."tenant_id"
    FROM (
      SELECT DISTINCT ON ("_parent_id") "_parent_id", "tenant_id"
      FROM "users_tenants"
      ORDER BY "_parent_id", "_order", "id"
    ) AS sub
    WHERE u."id" = sub."_parent_id";
  `)

  // 3. Drop the array table.
  await db.execute(sql`
    DROP TABLE "users_tenants" CASCADE;
  `)
}

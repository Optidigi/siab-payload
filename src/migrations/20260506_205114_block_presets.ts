import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Wave 2 — `block-presets` collection (tenant-scoped reusable block templates).
 *
 * Schema mirrors what `pnpm payload migrate:create` would have produced for
 * the new collection: a `block_presets` table with a `data` jsonb column,
 * tenant FK with ON DELETE CASCADE (matches the post-Wave-2 invariant from
 * `20260505_202447_cascade_tenant_delete`), and a `created_by_id` FK with
 * ON DELETE SET NULL (so deleting a user doesn't take their saved presets
 * down with them).
 *
 * Also adds `block_presets_id` to `payload_locked_documents_rels` per
 * Payload's per-collection convention; without this, the admin UI's
 * document-locking machinery throws when you try to save/edit one.
 *
 * Snapshot (`.json`) was hand-augmented from the previous migration's
 * snapshot (Docker wasn't running locally at authoring time, so
 * `migrate:create` couldn't autogen). Future `migrate:create` runs will
 * diff against this hand-written baseline; verify no spurious drift on
 * the next collection change. Pattern matches the hand-edit note in
 * `20260505_222023_grow_site_settings`.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "block_presets" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "name" varchar NOT NULL,
      "description" varchar,
      "block_type" varchar NOT NULL,
      "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "created_by_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "block_presets_id" integer;

    ALTER TABLE "block_presets" ADD CONSTRAINT "block_presets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "block_presets" ADD CONSTRAINT "block_presets_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_block_presets_fk" FOREIGN KEY ("block_presets_id") REFERENCES "public"."block_presets"("id") ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "block_presets_tenant_idx" ON "block_presets" USING btree ("tenant_id");
    CREATE INDEX "block_presets_tenant_block_type_idx" ON "block_presets" USING btree ("tenant_id","block_type");
    CREATE INDEX "block_presets_created_by_idx" ON "block_presets" USING btree ("created_by_id");
    CREATE INDEX "block_presets_updated_at_idx" ON "block_presets" USING btree ("updated_at");
    CREATE INDEX "block_presets_created_at_idx" ON "block_presets" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_block_presets_id_idx" ON "payload_locked_documents_rels" USING btree ("block_presets_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_block_presets_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_block_presets_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "block_presets_id";
    DROP TABLE "block_presets" CASCADE;
  `)
}

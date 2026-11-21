import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fuzzy, accent-insensitive search (ARCHITECTURE §3). `unaccent()` is only
 * STABLE, so it cannot back an index: `f_unaccent()` pins the dictionary and is
 * IMMUTABLE. Queries must use the exact indexed expression,
 * `f_unaccent(lower(column))`, for the planner to pick these GIN indexes.
 * TypeORM ignores expression indexes, so they live only here.
 */
export class EnableSearch1795285862288 implements MigrationInterface {
  name = 'EnableSearch1795285862288';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION "f_unaccent"(text) RETURNS text
         LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
         AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tracks_title_trgm" ON "tracks" USING gin (f_unaccent(lower("title")) gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_albums_title_trgm" ON "albums" USING gin (f_unaccent(lower("title")) gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_artists_name_trgm" ON "artists" USING gin (f_unaccent(lower("name")) gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_artists_name_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_albums_title_trgm"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tracks_title_trgm"`);
    await queryRunner.query(`DROP FUNCTION "f_unaccent"(text)`);
    // The extensions stay: other objects may depend on them.
  }
}

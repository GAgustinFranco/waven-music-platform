import { MigrationInterface, QueryRunner } from 'typeorm';

// "catalog_source" is shared by the three tables, so it is created once and dropped last.
export class CreateCatalog1795223720897 implements MigrationInterface {
  name = 'CreateCatalog1795223720897';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."catalog_source" AS ENUM('upload', 'jamendo', 'local')`,
    );
    await queryRunner.query(
      `CREATE TABLE "artists" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(200) NOT NULL, "slug" character varying(220) NOT NULL, "bio" text, "image_key" character varying(255), "source" "public"."catalog_source" NOT NULL DEFAULT 'upload', "source_id" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d8698856b9f9735db7470841363" UNIQUE ("slug"), CONSTRAINT "PK_09b823d4607d2675dc4ffa82261" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_artists_source" ON "artists"  ("source", "source_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "albums" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "artist_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "slug" character varying(220) NOT NULL, "release_date" date, "cover_key" character varying(255), "dominant_color" character(7), "source" "public"."catalog_source" NOT NULL DEFAULT 'upload', "source_id" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_838ebae24d2e12082670ffc95d7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_albums_release_date" ON "albums"  ("release_date") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_albums_source" ON "albums"  ("source", "source_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_albums_artist_slug" ON "albums"  ("artist_id", "slug") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."track_status" AS ENUM('pending', 'processing', 'ready', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tracks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "album_id" uuid NOT NULL, "artist_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "track_number" integer NOT NULL, "duration_ms" integer, "audio_key_std" character varying(255), "audio_key_high" character varying(255), "status" "public"."track_status" NOT NULL DEFAULT 'pending', "play_count" integer NOT NULL DEFAULT '0', "source" "public"."catalog_source" NOT NULL DEFAULT 'upload', "source_id" character varying(255), "license" character varying(100), "attribution_url" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_242a37ffc7870380f0e611986e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_tracks_play_count" ON "tracks"  ("play_count") `);
    await queryRunner.query(`CREATE INDEX "IDX_tracks_artist" ON "tracks"  ("artist_id") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tracks_album" ON "tracks"  ("album_id", "track_number") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tracks_source" ON "tracks"  ("source", "source_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "albums" ADD CONSTRAINT "FK_b6465bf462c2ffef5f066bc6f21" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tracks" ADD CONSTRAINT "FK_fceb1d9483fda6a312af244a80e" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tracks" ADD CONSTRAINT "FK_495f8b68c75ac5c9b0301a85b32" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tracks" DROP CONSTRAINT "FK_495f8b68c75ac5c9b0301a85b32"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tracks" DROP CONSTRAINT "FK_fceb1d9483fda6a312af244a80e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "albums" DROP CONSTRAINT "FK_b6465bf462c2ffef5f066bc6f21"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_tracks_source"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tracks_album"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tracks_artist"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tracks_play_count"`);
    await queryRunner.query(`DROP TABLE "tracks"`);
    await queryRunner.query(`DROP TYPE "public"."track_status"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_albums_artist_slug"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_albums_source"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_albums_release_date"`);
    await queryRunner.query(`DROP TABLE "albums"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_artists_source"`);
    await queryRunner.query(`DROP TABLE "artists"`);
    await queryRunner.query(`DROP TYPE "public"."catalog_source"`);
  }
}

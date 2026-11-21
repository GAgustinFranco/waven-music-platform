import { MigrationInterface, QueryRunner } from 'typeorm';

// Newest-first index for GET /me/favorites; TypeORM cannot express DESC, so it is set here.
export class CreateLibrary1795283489223 implements MigrationInterface {
  name = 'CreateLibrary1795283489223';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "favorites" ("user_id" uuid NOT NULL, "track_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_831ef6e707e132144aaf225f8c6" PRIMARY KEY ("user_id", "track_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_favorites_user_created_at" ON "favorites"  ("user_id", "created_at" DESC) `,
    );
    await queryRunner.query(
      `CREATE TABLE "playlists" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "owner_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "description" character varying(300), "cover_key" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a4597f4189a75d20507f3f7ef0d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_playlists_owner_created_at" ON "playlists"  ("owner_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "playlist_tracks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "playlist_id" uuid NOT NULL, "track_id" uuid NOT NULL, "position" integer NOT NULL, "added_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_playlist_tracks_position" UNIQUE ("playlist_id", "position") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "PK_0f93b1a2df4de2e5b48c1459617" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_playlist_tracks_track" ON "playlist_tracks"  ("track_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" ADD CONSTRAINT "FK_35a6b05ee3b624d0de01ee50593" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" ADD CONSTRAINT "FK_d8d3b0b8b67970531d4a097a100" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "playlists" ADD CONSTRAINT "FK_891195fd52d0fe011ac038fc103" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "playlist_tracks" ADD CONSTRAINT "FK_7ef165e08a3b87eae8cf4275cda" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "playlist_tracks" ADD CONSTRAINT "FK_54ef043760f89cdf4d660cf601c" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "playlist_tracks" DROP CONSTRAINT "FK_54ef043760f89cdf4d660cf601c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playlist_tracks" DROP CONSTRAINT "FK_7ef165e08a3b87eae8cf4275cda"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playlists" DROP CONSTRAINT "FK_891195fd52d0fe011ac038fc103"`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" DROP CONSTRAINT "FK_d8d3b0b8b67970531d4a097a100"`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorites" DROP CONSTRAINT "FK_35a6b05ee3b624d0de01ee50593"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_playlist_tracks_track"`);
    await queryRunner.query(`DROP TABLE "playlist_tracks"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_playlists_owner_created_at"`);
    await queryRunner.query(`DROP TABLE "playlists"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_favorites_user_created_at"`);
    await queryRunner.query(`DROP TABLE "favorites"`);
  }
}

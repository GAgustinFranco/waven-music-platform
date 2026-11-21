import { MigrationInterface, QueryRunner } from 'typeorm';

// Newest-first index for GET /me/history (SPEC §4); TypeORM cannot express DESC, so it is set here.
export class CreatePlayHistory1795279198082 implements MigrationInterface {
  name = 'CreatePlayHistory1795279198082';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."play_context" AS ENUM('album', 'artist', 'playlist', 'search', 'home', 'favorites', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "play_history" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "track_id" uuid NOT NULL, "play_id" uuid NOT NULL, "ms_played" integer NOT NULL, "context" "public"."play_context" NOT NULL, "played_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_54d2c87cce416cde980569353cc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_play_history_user_play" ON "play_history"  ("user_id", "play_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_play_history_user_played_at" ON "play_history"  ("user_id", "played_at" DESC) `,
    );
    await queryRunner.query(
      `ALTER TABLE "play_history" ADD CONSTRAINT "FK_6b831b95a0cdb3309265e95db54" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "play_history" ADD CONSTRAINT "FK_b285b9d14f87bf2d586cceec1a6" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "play_history" DROP CONSTRAINT "FK_b285b9d14f87bf2d586cceec1a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "play_history" DROP CONSTRAINT "FK_6b831b95a0cdb3309265e95db54"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_play_history_user_played_at"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_play_history_user_play"`);
    await queryRunner.query(`DROP TABLE "play_history"`);
    await queryRunner.query(`DROP TYPE "public"."play_context"`);
  }
}

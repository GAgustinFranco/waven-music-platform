import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the Premium "Ambient" backdrop. */
export class AddAmbientBackdrop1795610000000 implements MigrationInterface {
  name = 'AddAmbientBackdrop1795610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."app_backdrop" ADD VALUE IF NOT EXISTS 'ambient'`);
  }

  /** Postgres cannot drop an enum value, so the type is rebuilt; Ambient falls back to Soft glow. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "backdrop" = 'glow' WHERE "backdrop" = 'ambient'`);
    await queryRunner.query(`ALTER TYPE "public"."app_backdrop" RENAME TO "app_backdrop_old"`);
    await queryRunner.query(`CREATE TYPE "public"."app_backdrop" AS ENUM('solid', 'glow')`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "backdrop" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "backdrop" TYPE "public"."app_backdrop" USING "backdrop"::"text"::"public"."app_backdrop"`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "backdrop" SET DEFAULT 'solid'`);
    await queryRunner.query(`DROP TYPE "public"."app_backdrop_old"`);
  }
}

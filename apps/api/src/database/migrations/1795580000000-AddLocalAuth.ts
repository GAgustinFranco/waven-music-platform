import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocalAuth1795580000000 implements MigrationInterface {
  name = 'AddLocalAuth1795580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "password_hash" text`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "google_id" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_has_credential" CHECK ("google_id" IS NOT NULL OR "password_hash" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_has_credential"`);
    // Password-only accounts cannot exist without a Google id.
    await queryRunner.query(`DELETE FROM "users" WHERE "google_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "google_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_hash"`);
  }
}

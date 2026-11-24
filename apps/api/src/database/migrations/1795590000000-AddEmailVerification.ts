import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerification1795590000000 implements MigrationInterface {
  name = 'AddEmailVerification1795590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verification_token_hash" character(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_5dd2477e9857f8b66db49ecae4d" UNIQUE ("email_verification_token_hash")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verification_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    // Google verifies its emails, so existing Google accounts count as verified.
    await queryRunner.query(
      `UPDATE "users" SET "email_verified_at" = "created_at" WHERE "google_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verification_expires_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_5dd2477e9857f8b66db49ecae4d"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verification_token_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified_at"`);
  }
}

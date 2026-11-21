import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptions1795292683110 implements MigrationInterface {
  name = 'CreateSubscriptions1795292683110';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."payment_mode" AS ENUM('preapproval', 'onetime')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'authorized', 'paused', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "provider" character varying(32) NOT NULL, "mode" "public"."payment_mode" NOT NULL, "external_id" character varying(255), "status" "public"."subscription_status" NOT NULL DEFAULT 'pending', "amount" numeric(12,2) NOT NULL, "currency" character(3) NOT NULL, "current_period_end" TIMESTAMP WITH TIME ZONE, "cancelled_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_user" ON "subscriptions"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_subscriptions_active_user" ON "subscriptions"  ("user_id") WHERE "status" IN ('pending', 'authorized')`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_d0a95ef8a28188364c546eb65c1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_d0a95ef8a28188364c546eb65c1"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_subscriptions_active_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_subscriptions_user"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TYPE "public"."subscription_status"`);
    await queryRunner.query(`DROP TYPE "public"."payment_mode"`);
  }
}

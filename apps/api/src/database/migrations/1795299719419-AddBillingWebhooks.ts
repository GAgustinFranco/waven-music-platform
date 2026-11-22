import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingWebhooks1795299719419 implements MigrationInterface {
  name = 'AddBillingWebhooks1795299719419';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "webhook_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "provider" character varying(32) NOT NULL, "external_event_id" character varying(255) NOT NULL, "type" character varying(64) NOT NULL, "payload" jsonb NOT NULL, "processed_at" TIMESTAMP WITH TIME ZONE, "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_webhook_events_provider_event" UNIQUE ("provider", "external_event_id"), CONSTRAINT "PK_4cba37e6a0acb5e1fc49c34ebfd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD "last_payment_id" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN "last_payment_id"`);
    await queryRunner.query(`DROP TABLE "webhook_events"`);
  }
}

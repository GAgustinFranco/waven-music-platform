import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAppearance1795491454120 implements MigrationInterface {
  name = 'AddUserAppearance1795491454120';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."app_theme" AS ENUM('violet', 'dynamic', 'ocean', 'ember', 'rose', 'aurora', 'sunset', 'mono')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "theme" "public"."app_theme" NOT NULL DEFAULT 'violet'`,
    );
    await queryRunner.query(`CREATE TYPE "public"."app_backdrop" AS ENUM('solid', 'glow')`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "backdrop" "public"."app_backdrop" NOT NULL DEFAULT 'solid'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "backdrop"`);
    await queryRunner.query(`DROP TYPE "public"."app_backdrop"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "theme"`);
    await queryRunner.query(`DROP TYPE "public"."app_theme"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateExpenseTypes1793351626145 implements MigrationInterface {
  name = 'CreateExpenseTypes1793351626145'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "expense_types" ("id" uuid NOT NULL, "name" character varying(20) NOT NULL, "description" character varying(100) NOT NULL DEFAULT '', "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_expense_types_name" UNIQUE ("name"), CONSTRAINT "PK_84c519d5ded69fbf55ab41910df" PRIMARY KEY ("id"))`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "expense_types"`)
  }
}

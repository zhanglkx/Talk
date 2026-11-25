import type { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateExpenseReports1795613331721 implements MigrationInterface {
  name = 'CreateExpenseReports1795613331721'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "expense_reports" (
        "id" uuid NOT NULL,
        "applicant_id" uuid NOT NULL,
        "reason" varchar(50) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'draft',
        "total_cents" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_expense_reports" PRIMARY KEY ("id"),
        CONSTRAINT "ck_expense_reports_reason_nonempty" CHECK (btrim(reason) <> ''),
        CONSTRAINT "ck_expense_reports_status" CHECK (status = 'draft'),
        CONSTRAINT "ck_expense_reports_total_cents" CHECK (total_cents BETWEEN 1 AND 100000000)
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "expense_report_items" (
        "id" uuid NOT NULL,
        "report_id" uuid NOT NULL,
        "expense_type_id" uuid NOT NULL,
        "amount_cents" integer NOT NULL,
        "incurred_on" date NOT NULL,
        "description" varchar(100) NOT NULL DEFAULT '',
        "position" smallint NOT NULL,
        CONSTRAINT "pk_expense_report_items" PRIMARY KEY ("id"),
        CONSTRAINT "ck_expense_report_items_amount_cents" CHECK (amount_cents BETWEEN 1 AND 5000000),
        CONSTRAINT "ck_expense_report_items_position" CHECK (position BETWEEN 1 AND 20),
        CONSTRAINT "fk_expense_report_items_report" FOREIGN KEY ("report_id")
          REFERENCES "expense_reports" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_expense_report_items_expense_type" FOREIGN KEY ("expense_type_id")
          REFERENCES "expense_types" ("id") ON DELETE RESTRICT
      )
    `)

    // 列表按申请人和状态筛选；创建时间相同的单据用 ID 倒序稳定翻页。
    await queryRunner.query(`
      CREATE INDEX "idx_expense_reports_applicant_status_created_id"
      ON "expense_reports" ("applicant_id", "status", "created_at" DESC, "id" DESC)
    `)
    await queryRunner.query(`
      CREATE INDEX "idx_expense_report_items_report_position"
      ON "expense_report_items" ("report_id", "position")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 明细引用单据，所以先删明细。PostgreSQL 会随表移除各自的索引和约束。
    await queryRunner.query('DROP TABLE "expense_report_items"')
    await queryRunner.query('DROP TABLE "expense_reports"')
  }
}

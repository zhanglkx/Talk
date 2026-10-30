import { MigrationInterface, QueryRunner } from 'typeorm'

// 第一个 migration 已经提交并推送，不能再改它，所以用一个新的 migration 往前改。
// 这一条是手写的：TypeORM 比较表结构时不比较主键约束的名字，migration:generate 生成不出来。
// 用 RENAME 而不是先删再建主键：只改名字，不用重建主键的索引。
export class NameExpenseTypesPrimaryKey1793353278841 implements MigrationInterface {
  name = 'NameExpenseTypesPrimaryKey1793353278841'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expense_types" RENAME CONSTRAINT "PK_84c519d5ded69fbf55ab41910df" TO "pk_expense_types"`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expense_types" RENAME CONSTRAINT "pk_expense_types" TO "PK_84c519d5ded69fbf55ab41910df"`,
    )
  }
}

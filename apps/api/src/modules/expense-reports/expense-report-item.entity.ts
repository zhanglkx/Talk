import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm'
import { ExpenseReportEntity } from '@/modules/expense-reports/expense-report.entity.js'
import { ExpenseTypeEntity } from '@/modules/expense-types/expense-type.entity.js'

@Entity({ name: 'expense_report_items' })
@Index('idx_expense_report_items_report_position', ['reportId', 'position'])
@Check('ck_expense_report_items_amount_cents', 'amount_cents BETWEEN 1 AND 5000000')
@Check('ck_expense_report_items_position', 'position BETWEEN 1 AND 20')
export class ExpenseReportItemEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'pk_expense_report_items' })
  id: string

  @Column({ name: 'report_id', type: 'uuid' })
  reportId: string

  // 明细只属于一张单，草稿整单删除时由外键一并清理明细。
  @ManyToOne(() => ExpenseReportEntity, (report) => report.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'report_id', foreignKeyConstraintName: 'fk_expense_report_items_report' })
  report: Relation<ExpenseReportEntity>

  @Column({ name: 'expense_type_id', type: 'uuid' })
  expenseTypeId: string

  // 历史明细仍要显示类型的当前名称，所以被引用的类型可以停用，但不能删除。
  @ManyToOne(() => ExpenseTypeEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'expense_type_id',
    foreignKeyConstraintName: 'fk_expense_report_items_expense_type',
  })
  expenseType: Relation<ExpenseTypeEntity>

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number

  // 费用按自然日记账，保留 YYYY-MM-DD，避免转换时区后变成另一天。
  @Column({ name: 'incurred_on', type: 'date' })
  incurredOn: string

  @Column({ type: 'varchar', length: 100, default: '' })
  description: string

  @Column({ type: 'smallint' })
  position: number
}

import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm'
import { ExpenseReportItemEntity } from '@/modules/expense-reports/expense-report-item.entity.js'

@Entity({ name: 'expense_reports' })
@Check('ck_expense_reports_reason_nonempty', "btrim(reason) <> ''")
@Check('ck_expense_reports_status', "status = 'draft'")
@Check('ck_expense_reports_total_cents', 'total_cents BETWEEN 1 AND 100000000')
// 列表索引由迁移创建，以保留 PostgreSQL 的排序方向 (applicant_id, status, created_at DESC, id DESC)。
@Index('idx_expense_reports_applicant_status_created_id', { synchronize: false })
export class ExpenseReportEntity {
  // 应用先生成 UUIDv7，写入单据和明细时就能共用这个单据 ID。
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'pk_expense_reports' })
  id: string

  @Column({ name: 'applicant_id', type: 'uuid' })
  applicantId: string

  @Column({ type: 'varchar', length: 50 })
  reason: string

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: 'draft'

  // 保存草稿时，服务端须按整数分汇总明细，并在同一事务中更新总额。
  @Column({ name: 'total_cents', type: 'integer' })
  totalCents: number

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date

  @OneToMany(() => ExpenseReportItemEntity, (item) => item.report)
  items: Relation<ExpenseReportItemEntity[]>
}

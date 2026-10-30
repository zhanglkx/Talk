import { Column, CreateDateColumn, Entity, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm'

// 表在代码里的样子。真正的表结构以 migration 为准（synchronize 已关闭）：
// 改了这里的字段，要再生成一个新的 migration。约束都显式命名，以后的 migration 要改它时能直接写出名字
@Entity({ name: 'expense_types' })
// 名称不能重复（包括已停用的）。两个请求同时新增同名类型时，代码里先查再插挡不住，由数据库唯一约束兜底
@Unique('uq_expense_types_name', ['name'])
export class ExpenseTypeEntity {
  // 主键由应用用 crypto.randomUUIDv7() 生成，所以不用 @PrimaryGeneratedColumn（它让数据库生成随机的 UUIDv4）
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'pk_expense_types' })
  id: string

  @Column({ type: 'varchar', length: 20 })
  name: string

  @Column({ type: 'varchar', length: 100, default: '' })
  description: string

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  // TypeORM 默认建成不带时区的 timestamp，这里显式写 timestamptz
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date
}

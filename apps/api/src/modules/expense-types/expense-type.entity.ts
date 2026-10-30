import { PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Entity, Unique } from 'typeorm'

@Entity({ name: 'expense_types' })
export class ExpenseTypeEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string

  @Unique('uq_expense_types_name', ['name'])
  @Column({ type: 'varchar', length: 20 })
  name: string

  @Column({ type: 'varchar', length: 100, default: '' })
  description: string

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date
}

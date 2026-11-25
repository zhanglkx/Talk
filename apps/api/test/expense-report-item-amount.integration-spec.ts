import { randomUUIDv7 } from 'node:crypto'
import { DataSource, type QueryRunner } from 'typeorm'
import { readTestDatabaseConnection } from '@/config/test-database.js'
import { ExpenseReportItemEntity } from '@/modules/expense-reports/expense-report-item.entity.js'
import { ExpenseReportEntity } from '@/modules/expense-reports/expense-report.entity.js'
import { ExpenseTypeEntity } from '@/modules/expense-types/expense-type.entity.js'

describe('报销明细金额（PostgreSQL）', () => {
  const db = new DataSource({
    type: 'postgres',
    ...readTestDatabaseConnection(process.env),
    entities: [ExpenseTypeEntity, ExpenseReportEntity, ExpenseReportItemEntity],
    synchronize: false,
  })
  let runner: QueryRunner
  let item: ExpenseReportItemEntity

  beforeAll(async () => {
    await db.initialize()
  })

  beforeEach(async () => {
    runner = db.createQueryRunner()
    await runner.startTransaction()
    const expenseTypeId = randomUUIDv7()
    const reportId = randomUUIDv7()
    await runner.manager.insert(ExpenseTypeEntity, {
      id: expenseTypeId,
      name: `交通-${expenseTypeId.slice(-12)}`,
    })
    await runner.manager.insert(ExpenseReportEntity, {
      id: reportId,
      applicantId: randomUUIDv7(),
      reason: '出差交通费',
      totalCents: 1,
    })
    item = runner.manager.create(ExpenseReportItemEntity, {
      id: randomUUIDv7(),
      reportId,
      expenseTypeId,
      amountCents: 1,
      incurredOn: new Date().toISOString().slice(0, 10),
      position: 1,
    })
  })

  afterEach(async () => {
    // 约束报错后 PostgreSQL 会中止事务，回滚也会清掉本用例的草稿和报销类型。
    try {
      if (runner.isTransactionActive) await runner.rollbackTransaction()
    } finally {
      await runner.release()
    }
  })

  afterAll(async () => {
    if (db.isInitialized) await db.destroy()
  })

  it('1 分可以写入，并能按明细 ID 读回 1 分', async () => {
    await runner.manager.insert(ExpenseReportItemEntity, item)
    const saved = await runner.manager.findOneByOrFail(ExpenseReportItemEntity, { id: item.id })
    expect(saved.amountCents).toBe(1)
  })

  it('0 分触发明细金额检查约束', async () => {
    item.amountCents = 0
    await expect(runner.manager.insert(ExpenseReportItemEntity, item)).rejects.toMatchObject({
      driverError: { code: '23514', constraint: 'ck_expense_report_items_amount_cents' },
    })
  })
})

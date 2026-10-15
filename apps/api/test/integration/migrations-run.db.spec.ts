import type { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectTestDatabase, prepareMigratedDatabase } from './support/test-database.js'

// 迁移命令本身的行为：空库上按顺序执行全部迁移，第二次执行什么都不做。
// 各张表的结构和约束分别在 users-migration.db.spec.ts、sessions-migration.db.spec.ts 检查。
let client: Client | undefined
let firstRunOutput = ''
let secondRunOutput = ''

function database(): Client {
  if (!client) throw new Error('Test database client is not connected')
  return client
}

beforeAll(async () => {
  const { target, outputs } = await prepareMigratedDatabase(2)
  firstRunOutput = outputs[0] ?? ''
  secondRunOutput = outputs[1] ?? ''
  client = await connectTestDatabase(target)
})

afterAll(async () => {
  await client?.end()
})

describe('explicit migration runs on a real PostgreSQL database', () => {
  it('runs every pending migration in timestamp order on an empty database', () => {
    expect(firstRunOutput).toContain('2 migrations are new migrations must be executed.')
    const usersDone = firstRunOutput.indexOf(
      'Migration CreateUsers1791849600000 has been executed successfully.',
    )
    const sessionsDone = firstRunOutput.indexOf(
      'Migration CreateSessions1791936000000 has been executed successfully.',
    )
    expect(usersDone).toBeGreaterThan(-1)
    expect(sessionsDone).toBeGreaterThan(usersDone)
    expect(firstRunOutput).toMatch(/CREATE TABLE "users"/)
    expect(firstRunOutput).toMatch(/CREATE TABLE "sessions"/)
  })

  it('leaves only the business tables and one history row per migration', async () => {
    const tables = await database().query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    )
    expect(tables.rows.map((row) => row.table_name)).toEqual(['migrations', 'sessions', 'users'])

    const history = await database().query<{ name: string; timestamp: string }>(
      'SELECT name, timestamp FROM migrations ORDER BY id',
    )
    expect(history.rows).toEqual([
      { name: 'CreateUsers1791849600000', timestamp: '1791849600000' },
      { name: 'CreateSessions1791936000000', timestamp: '1791936000000' },
    ])
  })

  it('finds nothing pending on the second run and creates no table', async () => {
    expect(secondRunOutput).toContain('No migrations are pending')
    expect(secondRunOutput).not.toMatch(/CREATE TABLE/i)

    const history = await database().query<{ count: string }>(
      'SELECT count(*) AS count FROM migrations',
    )
    expect(history.rows[0]?.count).toBe('2')
  })
})

import { describe, expect, it } from 'vitest'
import { resolveResettableTestDatabase } from './support/test-database.js'

// 删除重建测试库之前的检查只做字符串判断，不连接数据库。
// 这道检查挡住的是「一条命令把开发库清空」，所以单独锁进测试。
const allowed = {
  DATABASE_URL: 'postgresql://127.0.0.1:5432/ledger_it',
  ALLOW_DATABASE_RESET: 'ledger_it',
}

describe('test database reset guard', () => {
  it('accepts the dedicated local test database and derives the maintenance database', () => {
    expect(resolveResettableTestDatabase(allowed)).toEqual({
      databaseUrl: 'postgresql://127.0.0.1:5432/ledger_it',
      maintenanceUrl: 'postgresql://127.0.0.1:5432/postgres',
      databaseName: 'ledger_it',
    })
  })

  it('refuses to run without DATABASE_URL', () => {
    expect(() => resolveResettableTestDatabase({ ALLOW_DATABASE_RESET: 'ledger_it' })).toThrow(
      /needs DATABASE_URL/,
    )
  })

  it('refuses to reset without an explicit confirmation naming the database', () => {
    expect(() => resolveResettableTestDatabase({ DATABASE_URL: allowed.DATABASE_URL })).toThrow(
      /ALLOW_DATABASE_RESET=ledger_it/,
    )
    expect(() =>
      resolveResettableTestDatabase({ ...allowed, ALLOW_DATABASE_RESET: 'true' }),
    ).toThrow(/ALLOW_DATABASE_RESET=ledger_it/)
  })

  it.each(['postgres', 'ledger', 'ledger_it_copy'])(
    'refuses to reset the non-dedicated database %s',
    (databaseName) => {
      expect(() =>
        resolveResettableTestDatabase({
          DATABASE_URL: `postgresql://127.0.0.1:5432/${databaseName}`,
          ALLOW_DATABASE_RESET: databaseName,
        }),
      ).toThrow(/only resets "ledger_it"/)
    },
  )

  it('refuses a remote host even when the database name matches', () => {
    expect(() =>
      resolveResettableTestDatabase({
        ...allowed,
        DATABASE_URL: 'postgresql://db.example.test:5432/ledger_it',
      }),
    ).toThrow(/only resets a local database/)
  })

  it('refuses query parameters that could redirect the connection', () => {
    expect(() =>
      resolveResettableTestDatabase({
        ...allowed,
        DATABASE_URL: 'postgresql://127.0.0.1:5432/ledger_it?host=db.example.test',
      }),
    ).toThrow(/query parameters/)
  })
})

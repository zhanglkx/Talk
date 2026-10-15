import 'reflect-metadata'
import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import type { TestingModule } from '@nestjs/testing'
import type { Client } from 'pg'
import { DataSource } from 'typeorm'
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner.js'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { validateEnvironment } from '../../src/config/validate-environment.js'
import { DatabaseModule } from '../../src/database/database.module.js'
import { connectTestDatabase, prepareMigratedDatabase } from './support/test-database.js'

const usersModulePath = new URL('../../src/modules/users/users.module.ts', import.meta.url).href
const usersRepositoryPath = new URL('../../src/modules/users/users.repository.ts', import.meta.url)
  .href

type UsersRepositoryLike = {
  findPublicById(id: string): Promise<unknown>
  findCredentialsByUsername(username: string): Promise<unknown>
}

// 两个虚构用户直接写进库里（已提交），供 Repository 读取；下次运行会重建整个测试库。
const alice = { id: randomUUID(), username: 'fixture_alice', passwordHash: 'fixture-hash-alice' }
const bob = { id: randomUUID(), username: 'fixture_bob', passwordHash: 'fixture-hash-bob' }

let client: Client | undefined
let moduleRef: TestingModule | undefined
let repository: UsersRepositoryLike | undefined
let dataSource: DataSource | undefined

function users(): UsersRepositoryLike {
  if (!repository) throw new Error('UsersRepository is not available')
  return repository
}

// 收集一次调用期间发给 PostgreSQL 的 SQL，用来确认实际选了哪些列。
async function captureSql<T>(work: () => Promise<T>): Promise<{ result: T; sql: string[] }> {
  const query = vi.spyOn(PostgresQueryRunner.prototype, 'query')
  try {
    const result = await work()
    return { result, sql: query.mock.calls.map((call) => String(call[0])) }
  } finally {
    query.mockRestore()
  }
}

beforeAll(async () => {
  const { target } = await prepareMigratedDatabase()
  client = await connectTestDatabase(target)
  for (const user of [alice, bob]) {
    await client.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [
      user.id,
      user.username,
      user.passwordHash,
    ])
  }

  const { UsersModule } = await import(usersModulePath)
  const { UsersRepository } = await import(usersRepositoryPath)
  // 真实的配置、DatabaseModule 和 UsersModule；DATABASE_URL 来自 test:db 命令，指向 ledger_it。
  moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnvironment }),
      DatabaseModule,
      UsersModule,
    ],
  }).compile()
  await moduleRef.init()
  repository = moduleRef.get<UsersRepositoryLike>(UsersRepository)
  dataSource = moduleRef.get(DataSource)
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  // 关闭容器会销毁连接池；不关的话，下一个测试文件重建 ledger_it 时会因库被占用而失败。
  await moduleRef?.close()
  await client?.end()
})

describe('UsersRepository on a real PostgreSQL database', () => {
  // 必须是第一个用例：它检查的是容器启动后、任何查询之前的状态。
  it('connects on the first query without a readiness probe, only once for concurrent callers', async () => {
    expect(dataSource?.isInitialized).toBe(false)
    const initialize = vi.spyOn(DataSource.prototype, 'initialize')

    const [first, second] = await Promise.all([
      users().findPublicById(alice.id),
      users().findCredentialsByUsername(bob.username),
    ])

    expect(initialize).toHaveBeenCalledOnce()
    expect(dataSource?.isInitialized).toBe(true)
    expect(first).toMatchObject({ id: alice.id })
    expect(second).toMatchObject({ id: bob.id })
  })

  it('returns only the public identity as a plain object and never selects password_hash', async () => {
    const { result, sql } = await captureSql(() => users().findPublicById(alice.id))

    expect(result).toStrictEqual({ id: alice.id, username: alice.username })
    expect(sql.length).toBeGreaterThan(0)
    expect(sql.join('\n')).not.toMatch(/password_hash/)
  })

  it('returns null for an id that does not exist', async () => {
    await expect(users().findPublicById(randomUUID())).resolves.toBeNull()
  })

  it('returns the login credentials for an exact username as a plain object', async () => {
    await expect(users().findCredentialsByUsername(bob.username)).resolves.toStrictEqual({
      id: bob.id,
      username: bob.username,
      passwordHash: bob.passwordHash,
    })
  })

  it('returns null for a username that does not exist', async () => {
    await expect(users().findCredentialsByUsername('fixture_nobody')).resolves.toBeNull()
  })

  it('matches exactly and leaves normalization to the caller', async () => {
    await expect(users().findCredentialsByUsername('FIXTURE_ALICE')).resolves.toBeNull()
    await expect(users().findCredentialsByUsername(' fixture_alice ')).resolves.toBeNull()
  })

  it('passes input as a query parameter instead of splicing it into SQL', async () => {
    const hostile = "fixture_alice' OR '1'='1"
    const { result, sql } = await captureSql(() => users().findCredentialsByUsername(hostile))

    expect(result).toBeNull()
    expect(sql.join('\n')).not.toContain(hostile)
  })
})

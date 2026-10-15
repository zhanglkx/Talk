import 'reflect-metadata'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import type { TestingModule } from '@nestjs/testing'
import type { Client } from 'pg'
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner.js'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { validateEnvironment } from '../../src/config/validate-environment.js'
import { DatabaseModule } from '../../src/database/database.module.js'
import { connectTestDatabase, prepareMigratedDatabase } from './support/test-database.js'

const usersModulePath = new URL('../../src/modules/users/users.module.ts', import.meta.url).href
const usersRepositoryPath = new URL('../../src/modules/users/users.repository.ts', import.meta.url)
  .href

type CreateResult = 'created' | 'exists'
type UsersRepositoryLike = {
  findPublicById(id: string): Promise<unknown>
  findCredentialsByUsername(username: string): Promise<unknown>
  createIfAbsent(input: { username: string; passwordHash: string }): Promise<CreateResult>
}

// 写入检查只看 $argon2id$ 前缀，这里用虚构的哈希字符串，不跑真实哈希。
const hashA = '$argon2id$v=19$m=19456,t=2,p=1$fixture-salt-a$fixture-hash-a'
const hashB = '$argon2id$v=19$m=19456,t=2,p=1$fixture-salt-b$fixture-hash-b'
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let client: Client | undefined
let moduleRef: TestingModule | undefined
let repository: UsersRepositoryLike | undefined

function users(): UsersRepositoryLike {
  if (!repository) throw new Error('UsersRepository is not available')
  return repository
}

function database(): Client {
  if (!client) throw new Error('Test database client is not connected')
  return client
}

async function storedRows(username: string) {
  const result = await database().query<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE username = $1',
    [username],
  )
  return result.rows
}

beforeAll(async () => {
  const { target } = await prepareMigratedDatabase()
  client = await connectTestDatabase(target)

  const { UsersModule } = await import(usersModulePath)
  const { UsersRepository } = await import(usersRepositoryPath)
  moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnvironment }),
      DatabaseModule,
      UsersModule,
    ],
  }).compile()
  await moduleRef.init()
  repository = moduleRef.get<UsersRepositoryLike>(UsersRepository)
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  // 关闭容器释放连接池，下一个测试文件才能重建 ledger_it。
  await moduleRef?.close()
  await client?.end()
})

describe('UsersRepository.createIfAbsent on a real PostgreSQL database', () => {
  it('creates a missing user with a generated UUID that the read queries can find', async () => {
    await expect(
      users().createIfAbsent({ username: 'fixture_alice', passwordHash: hashA }),
    ).resolves.toBe('created')

    const rows = await storedRows('fixture_alice')
    expect(rows).toHaveLength(1)
    const [row] = rows
    expect(row?.id).toMatch(UUID_V4)
    expect(row?.password_hash).toBe(hashA)
    await expect(users().findCredentialsByUsername('fixture_alice')).resolves.toStrictEqual({
      id: row?.id,
      username: 'fixture_alice',
      passwordHash: hashA,
    })
    await expect(users().findPublicById(row?.id ?? '')).resolves.toStrictEqual({
      id: row?.id,
      username: 'fixture_alice',
    })
  })

  it('leaves an existing user untouched, including the stored password hash', async () => {
    await users().createIfAbsent({ username: 'fixture_bob', passwordHash: hashA })
    const before = await storedRows('fixture_bob')

    await expect(
      users().createIfAbsent({ username: 'fixture_bob', passwordHash: hashB }),
    ).resolves.toBe('exists')

    expect(await storedRows('fixture_bob')).toEqual(before)
    expect(before[0]?.password_hash).toBe(hashA)
  })

  it('creates exactly one row when two callers race for the same username', async () => {
    // 「先查再插」的实现单次赛跑大约一半概率会撞上唯一约束；跑 10 轮，漏过的概率约千分之一。
    for (let round = 0; round < 10; round += 1) {
      const username = `fixture_race_${round}`
      const results = await Promise.all([
        users().createIfAbsent({ username, passwordHash: hashA }),
        users().createIfAbsent({ username, passwordHash: hashB }),
      ])

      expect([...results].sort()).toEqual(['created', 'exists'])
      const rows = await storedRows(username)
      expect(rows).toHaveLength(1)
      expect([hashA, hashB]).toContain(rows[0]?.password_hash)
    }
  })

  it('passes the username and hash as query parameters', async () => {
    const query = vi.spyOn(PostgresQueryRunner.prototype, 'query')

    await users().createIfAbsent({ username: 'fixture_dave', passwordHash: hashA })

    const sql = query.mock.calls.map((call) => String(call[0])).join('\n')
    expect(sql).toMatch(/INSERT/i)
    expect(sql).not.toContain('fixture_dave')
    expect(sql).not.toContain(hashA)
  })
})

import 'reflect-metadata'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import type { TestingModule } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { PostgresQueryRunner } from 'typeorm/driver/postgres/PostgresQueryRunner.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateEnvironment } from '../src/config/validate-environment.js'
import { ConnectionLifecycleService } from '../src/database/connection-lifecycle.service.js'
import { DatabaseModule } from '../src/database/database.module.js'

const usersModulePath = new URL('../src/modules/users/users.module.ts', import.meta.url).href
const usersRepositoryPath = new URL('../src/modules/users/users.repository.ts', import.meta.url)
  .href

type UsersRepositoryLike = {
  findPublicById(id: string): Promise<unknown>
  findCredentialsByUsername(username: string): Promise<unknown>
  createIfAbsent(input: { username: string; passwordHash: string }): Promise<unknown>
}

const fixtureId = '00000000-0000-4000-8000-000000000001'
// 只需要以 $argon2id$ 开头；写入检查只看前缀，不校验整串格式。
const fixtureHash = '$argon2id$v=19$m=19456,t=2,p=1$fixture-salt$fixture-hash'
let moduleRef: TestingModule | undefined

beforeEach(() => {
  vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
    throw new Error('UsersRepository offline tests must not connect to the database')
  })
  vi.spyOn(PostgresQueryRunner.prototype, 'query').mockImplementation(() => {
    throw new Error('UsersRepository offline tests must not send SQL')
  })
})

afterEach(async () => {
  await moduleRef?.close()
  moduleRef = undefined
  vi.restoreAllMocks()
})

// 用真实的 DatabaseModule 和 UsersModule 组装，只把 ensureConnected 换成测试替身。
async function createRepository(ensureConnected: () => Promise<void>) {
  const { UsersModule } = await import(usersModulePath)
  const { UsersRepository } = await import(usersRepositoryPath)
  expect(UsersModule).toBeTypeOf('function')
  expect(UsersRepository).toBeTypeOf('function')

  moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnvironment }),
      DatabaseModule,
      UsersModule,
    ],
  })
    .overrideProvider(ConnectionLifecycleService)
    .useValue({ ensureConnected })
    .compile()
  await moduleRef.init()
  return moduleRef.get<UsersRepositoryLike>(UsersRepository)
}

describe('UsersRepository without a database', () => {
  it.each([
    ['findPublicById', (repository: UsersRepositoryLike) => repository.findPublicById(fixtureId)],
    [
      'findCredentialsByUsername',
      (repository: UsersRepositoryLike) => repository.findCredentialsByUsername('fixture_alice'),
    ],
    [
      'createIfAbsent',
      (repository: UsersRepositoryLike) =>
        repository.createIfAbsent({ username: 'fixture_alice', passwordHash: fixtureHash }),
    ],
  ])('%s connects first and rethrows the connection failure unchanged', async (_name, call) => {
    const unavailable = new Error('database unavailable')
    const ensureConnected = vi.fn().mockRejectedValue(unavailable)
    const repository = await createRepository(ensureConnected)

    await expect(call(repository)).rejects.toBe(unavailable)

    expect(ensureConnected).toHaveBeenCalledOnce()
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
    expect(PostgresQueryRunner.prototype.query).not.toHaveBeenCalled()
  })
})

describe('UsersRepository.createIfAbsent input checks', () => {
  // 检查必须在连接之前：不合格的数据既不写库，也不为它建立连接。
  it.each([
    ['upper-case letters', 'Fixture_Alice'],
    ['surrounding whitespace', ' fixture_alice '],
    ['too few characters', 'ab'],
    ['a character outside the rule', 'fixture-alice'],
  ])(
    'rejects a username that is not normalized (%s) before connecting',
    async (_case, username) => {
      const ensureConnected = vi.fn().mockResolvedValue(undefined)
      const repository = await createRepository(ensureConnected)

      await expect(
        repository.createIfAbsent({ username, passwordHash: fixtureHash }),
      ).rejects.toThrow()

      expect(ensureConnected).not.toHaveBeenCalled()
      expect(PostgresQueryRunner.prototype.query).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['a plain password', 'fixture-plain-password'],
    ['an empty string', ''],
    ['another Argon2 variant', '$argon2i$v=19$m=19456,t=2,p=1$fixture-salt$fixture-hash'],
    ['a prefix without the leading dollar sign', 'argon2id$v=19$m=19456,t=2,p=1$fixture'],
  ])('rejects %s as the password hash before connecting', async (_case, passwordHash) => {
    const ensureConnected = vi.fn().mockResolvedValue(undefined)
    const repository = await createRepository(ensureConnected)

    await expect(
      repository.createIfAbsent({ username: 'fixture_alice', passwordHash }),
    ).rejects.toThrow()

    expect(ensureConnected).not.toHaveBeenCalled()
    expect(PostgresQueryRunner.prototype.query).not.toHaveBeenCalled()
  })

  it('does not echo the rejected value in the error message', async () => {
    const repository = await createRepository(vi.fn().mockResolvedValue(undefined))
    // 传错的「哈希」很可能就是明文密码；错误信息会进日志，不能把它带出去。
    const plainPassword = 'fixture-plain-password'

    const error = await repository
      .createIfAbsent({ username: 'fixture_alice', passwordHash: plainPassword })
      .then(
        () => undefined,
        (reason: unknown) => reason,
      )

    expect(error).toBeInstanceOf(Error)
    expect(String((error as Error).message)).not.toContain(plainPassword)
    expect(String((error as Error).stack)).not.toContain(plainPassword)
  })
})

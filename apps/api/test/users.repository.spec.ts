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
}

const fixtureId = '00000000-0000-4000-8000-000000000001'
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

// 用真实的 DatabaseModule 和 UsersModule 组装，只把 ensureConnected 换成一定失败的替身。
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

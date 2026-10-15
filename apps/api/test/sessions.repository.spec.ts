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

const authModulePath = new URL('../src/modules/auth/auth.module.ts', import.meta.url).href
const sessionsRepositoryPath = new URL(
  '../src/modules/auth/sessions.repository.ts',
  import.meta.url,
).href

type SessionWindow = { lastSeenAt: Date; idleExpiresAt: Date; absoluteExpiresAt: Date }
type SessionsRepositoryLike = {
  create(
    sessionId: string,
    record: { userId: string; data: { csrfToken: string }; window: SessionWindow },
  ): Promise<void>
  findActive(sessionId: string, now: Date): Promise<unknown>
  update(
    sessionId: string,
    changes: { data: { csrfToken: string }; window: SessionWindow },
  ): Promise<boolean>
  delete(sessionId: string): Promise<void>
}

const sessionId = 'fixture-offline-session-id'
const now = new Date('2026-10-15T08:00:00.000Z')
const window = { lastSeenAt: now, idleExpiresAt: now, absoluteExpiresAt: now }
const data = { csrfToken: 'fixture-csrf-token' }
let moduleRef: TestingModule | undefined

beforeEach(() => {
  vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
    throw new Error('SessionsRepository offline tests must not connect to the database')
  })
  vi.spyOn(PostgresQueryRunner.prototype, 'query').mockImplementation(() => {
    throw new Error('SessionsRepository offline tests must not send SQL')
  })
})

afterEach(async () => {
  await moduleRef?.close()
  moduleRef = undefined
  vi.restoreAllMocks()
})

// 用真实的 DatabaseModule 和 AuthModule 组装，只把 ensureConnected 换成测试替身。
async function createRepository(ensureConnected: () => Promise<void>) {
  const { AuthModule } = await import(authModulePath)
  const { SessionsRepository } = await import(sessionsRepositoryPath)
  expect(AuthModule).toBeTypeOf('function')
  expect(SessionsRepository).toBeTypeOf('function')

  moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnvironment }),
      DatabaseModule,
      AuthModule,
    ],
  })
    .overrideProvider(ConnectionLifecycleService)
    .useValue({ ensureConnected })
    .compile()
  await moduleRef.init()
  return moduleRef.get<SessionsRepositoryLike>(SessionsRepository)
}

describe('SessionsRepository without a database', () => {
  it.each([
    [
      'create',
      (repository: SessionsRepositoryLike) =>
        repository.create(sessionId, {
          userId: '00000000-0000-4000-8000-000000000001',
          data,
          window,
        }),
    ],
    ['findActive', (repository: SessionsRepositoryLike) => repository.findActive(sessionId, now)],
    [
      'update',
      (repository: SessionsRepositoryLike) => repository.update(sessionId, { data, window }),
    ],
    ['delete', (repository: SessionsRepositoryLike) => repository.delete(sessionId)],
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

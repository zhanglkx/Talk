import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { getDataSourceToken } from '@nestjs/typeorm'
import type { DataSource } from 'typeorm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatabaseModule } from '../src/database/database.module.js'
import { DatabaseReadinessService } from '../src/database/database-readiness.service.js'

const databaseUrl = 'postgresql://ledger:secret@localhost:5432/ledger'

let closeTestingModule: (() => Promise<void>) | undefined

const compileDatabaseModule = async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        isGlobal: true,
        load: [() => ({ DATABASE_URL: databaseUrl })],
      }),
      DatabaseModule,
    ],
  }).compile()
  closeTestingModule = () => moduleRef.close()
  return moduleRef
}

afterEach(async () => {
  await closeTestingModule?.()
  closeTestingModule = undefined
  vi.restoreAllMocks()
})

describe('DatabaseModule', () => {
  it('configures a manually initialized PostgreSQL data source and exports readiness', async () => {
    const moduleRef = await compileDatabaseModule()

    const dataSource = moduleRef.get<DataSource>(getDataSourceToken())
    const readiness = moduleRef.get(DatabaseReadinessService)

    expect(dataSource.isInitialized).toBe(false)
    expect(dataSource.options).toMatchObject({
      type: 'postgres',
      url: databaseUrl,
      manualInitialization: true,
      synchronize: false,
      migrationsRun: false,
      entities: [],
      connectTimeoutMS: 3_000,
      extra: { query_timeout: 3_000 },
    })
    expect(readiness).toBeInstanceOf(DatabaseReadinessService)
  })

  it('logs only a fixed message when the database pool reports a sensitive error', async () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const moduleRef = await compileDatabaseModule()
    const dataSource = moduleRef.get<DataSource>(getDataSourceToken())
    const poolErrorHandler = (
      dataSource.options as { poolErrorHandler?: (error: Error) => void }
    ).poolErrorHandler
    const sensitiveError = Object.assign(
      new Error('connection failed for username=ledger host=db.internal password=secret'),
      { username: 'ledger', host: 'db.internal', password: 'secret' },
    )

    expect(poolErrorHandler).toBeTypeOf('function')
    poolErrorHandler?.(sensitiveError)

    expect(errorLog).toHaveBeenCalledOnce()
    expect(errorLog).toHaveBeenCalledWith('Database pool error')
    expect(errorLog).not.toHaveBeenCalledWith(sensitiveError)
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain(sensitiveError.message)
  })
})

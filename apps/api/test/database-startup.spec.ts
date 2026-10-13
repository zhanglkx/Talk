import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { ConnectionLifecycleService } from '../src/database/connection-lifecycle.service.js'

let app: INestApplication | undefined

afterEach(async () => {
  try {
    await app?.close()
  } finally {
    app = undefined
    vi.restoreAllMocks()
  }
})

describe('application startup', () => {
  it('initializes and closes the real AppModule without connecting to the database', async () => {
    const initialize = vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
      throw new Error('Application startup must not initialize the database')
    })
    const ensureConnected = vi
      .spyOn(ConnectionLifecycleService.prototype, 'ensureConnected')
      .mockImplementation(() => {
        throw new Error('Application startup must not request a database connection')
      })
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()

    await app.init()

    expect(initialize).not.toHaveBeenCalled()
    expect(ensureConnected).not.toHaveBeenCalled()

    await app.close()
    app = undefined

    expect(initialize).not.toHaveBeenCalled()
    expect(ensureConnected).not.toHaveBeenCalled()
  })
})

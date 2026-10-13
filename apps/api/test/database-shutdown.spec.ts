import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getDataSourceToken } from '@nestjs/typeorm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { ConnectionLifecycleService } from '../src/database/connection-lifecycle.service.js'

let app: INestApplication | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('application shutdown', () => {
  it('destroys the one connected data source once and does not connect again', async () => {
    const ensureConnected = vi.fn().mockResolvedValue(undefined)
    const initialize = vi.fn()
    const destroy = vi.fn().mockResolvedValue(undefined)
    const dataSource = {
      isInitialized: true,
      initialize,
      destroy,
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConnectionLifecycleService)
      .useValue({ ensureConnected })
      .overrideProvider(getDataSourceToken())
      .useValue(dataSource)
      .compile()
    app = moduleRef.createNestApplication()
    await app.init()

    initialize.mockClear()
    ensureConnected.mockClear()
    destroy.mockClear()

    await app.close()
    app = undefined

    expect(destroy).toHaveBeenCalledTimes(1)
    expect(initialize).not.toHaveBeenCalled()
    expect(ensureConnected).not.toHaveBeenCalled()
  })
})

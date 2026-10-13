import type { DataSource } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import { ConnectionLifecycleService } from '../src/database/connection-lifecycle.service.js'

type DataSourceStub = {
  isInitialized: boolean
  initialize: ReturnType<typeof vi.fn>
  runMigrations: ReturnType<typeof vi.fn>
}

const createDataSource = (): DataSourceStub => ({
  isInitialized: false,
  initialize: vi.fn(),
  runMigrations: vi.fn(),
})

const createService = (dataSource: DataSourceStub): ConnectionLifecycleService =>
  new ConnectionLifecycleService(dataSource as unknown as DataSource)

describe('ConnectionLifecycleService', () => {
  it('initializes once when two callers overlap, even if TypeORM already marks the source initialized', async () => {
    let resolveInitialization: ((value: DataSource) => void) | undefined
    const pendingInitialization = new Promise<DataSource>((resolve) => {
      resolveInitialization = resolve
    })
    const dataSource = createDataSource()
    dataSource.initialize.mockImplementation(() => {
      dataSource.isInitialized = true
      return pendingInitialization
    })
    const service = createService(dataSource)
    let secondSettled = false

    const first = service.ensureConnected()
    const second = service.ensureConnected().then(() => {
      secondSettled = true
    })

    expect(dataSource.initialize).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(secondSettled).toBe(false)

    resolveInitialization?.(dataSource as unknown as DataSource)
    await Promise.all([first, second])

    expect(dataSource.initialize).toHaveBeenCalledTimes(1)
    expect(dataSource.runMigrations).not.toHaveBeenCalled()
  })

  it('initializes again after a failed attempt', async () => {
    const dataSource = createDataSource()
    dataSource.initialize
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockImplementationOnce(async () => {
        dataSource.isInitialized = true
        return dataSource as unknown as DataSource
      })
    const service = createService(dataSource)

    await expect(service.ensureConnected()).rejects.toThrow('connection failed')
    await expect(service.ensureConnected()).resolves.toBeUndefined()

    expect(dataSource.initialize).toHaveBeenCalledTimes(2)
    expect(dataSource.runMigrations).not.toHaveBeenCalled()
  })

  it('does not initialize again after a successful connection', async () => {
    const dataSource = createDataSource()
    dataSource.initialize.mockImplementation(async () => {
      dataSource.isInitialized = true
      return dataSource as unknown as DataSource
    })
    const service = createService(dataSource)

    await service.ensureConnected()
    await service.ensureConnected()

    expect(dataSource.initialize).toHaveBeenCalledTimes(1)
    expect(dataSource.runMigrations).not.toHaveBeenCalled()
  })
})

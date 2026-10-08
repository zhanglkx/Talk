import { Logger } from '@nestjs/common'
import type { DataSource } from 'typeorm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatabaseReadinessService } from '../src/database/database-readiness.service.js'

type DataSourceStub = {
  isInitialized: boolean
  initialize: DataSource['initialize']
  query: DataSource['query']
}

const createDataSource = (isInitialized = false): DataSourceStub => ({
  isInitialized,
  initialize: vi.fn(),
  query: vi.fn(),
})

const createService = (dataSource: DataSourceStub): DatabaseReadinessService =>
  new DatabaseReadinessService(dataSource as DataSource)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DatabaseReadinessService', () => {
  it('initializes an uninitialized data source once and queries with SELECT 1', async () => {
    const dataSource = createDataSource()
    vi.mocked(dataSource.initialize).mockImplementation(async () => {
      dataSource.isInitialized = true
      return dataSource as DataSource
    })
    vi.mocked(dataSource.query).mockResolvedValue([{ '?column?': 1 }])

    const result = await createService(dataSource).isReady()

    expect(result).toBe(true)
    expect(dataSource.initialize).toHaveBeenCalledTimes(1)
    expect(dataSource.query).toHaveBeenCalledOnce()
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1')
  })

  it('does not initialize an already initialized data source', async () => {
    const dataSource = createDataSource(true)
    vi.mocked(dataSource.query).mockResolvedValue([{ '?column?': 1 }])

    const result = await createService(dataSource).isReady()

    expect(result).toBe(true)
    expect(dataSource.initialize).not.toHaveBeenCalled()
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1')
  })

  it('returns false without leaking a query error', async () => {
    const sensitiveMessage = 'password=do-not-leak'
    const dataSource = createDataSource(true)
    vi.mocked(dataSource.query).mockRejectedValue(new Error(sensitiveMessage))
    const warning = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    await expect(createService(dataSource).isReady()).resolves.toBe(false)
    expect(warning).toHaveBeenCalledWith('Database readiness check failed')
    expect(warning.mock.calls.flat().join(' ')).not.toContain(sensitiveMessage)
  })

  it('returns false when initialization fails', async () => {
    const dataSource = createDataSource()
    vi.mocked(dataSource.initialize).mockRejectedValue(new Error('connection failed'))
    const warning = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    await expect(createService(dataSource).isReady()).resolves.toBe(false)
    expect(dataSource.query).not.toHaveBeenCalled()
    expect(warning).toHaveBeenCalledWith('Database readiness check failed')
  })

  it('retries initialization on the next check after a failure and can succeed', async () => {
    const dataSource = createDataSource()
    vi.mocked(dataSource.initialize)
      .mockRejectedValueOnce(new Error('temporary connection failure'))
      .mockImplementationOnce(async () => {
        dataSource.isInitialized = true
        return dataSource as DataSource
      })
    vi.mocked(dataSource.query).mockResolvedValue([{ '?column?': 1 }])
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const service = createService(dataSource)

    await expect(service.isReady()).resolves.toBe(false)
    await expect(service.isReady()).resolves.toBe(true)

    expect(dataSource.initialize).toHaveBeenCalledTimes(2)
    expect(dataSource.query).toHaveBeenCalledOnce()
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1')
  })

  it('waits for a pending initialization even when TypeORM marks the data source initialized', async () => {
    let rejectInitialization: ((reason: Error) => void) | undefined
    const pendingInitialization = new Promise<DataSource>((_, reject) => {
      rejectInitialization = reject
    })
    const dataSource = createDataSource()
    vi.mocked(dataSource.initialize).mockImplementation(() => {
      dataSource.isInitialized = true
      return pendingInitialization
    })
    const warning = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const service = createService(dataSource)

    const firstCheck = service.isReady()
    const secondCheck = service.isReady()
    rejectInitialization?.(new Error('connection failed with password=do-not-leak'))

    await expect(Promise.all([firstCheck, secondCheck])).resolves.toEqual([false, false])
    expect(dataSource.initialize).toHaveBeenCalledTimes(1)
    expect(dataSource.query).not.toHaveBeenCalled()
    expect(warning).toHaveBeenCalledWith('Database readiness check failed')
  })

  it('shares one pending initialization promise between concurrent checks', async () => {
    let resolveInitialization: ((value: DataSource) => void) | undefined
    const pendingInitialization = new Promise<DataSource>((resolve) => {
      resolveInitialization = resolve
    })
    const dataSource = createDataSource()
    vi.mocked(dataSource.initialize).mockReturnValue(pendingInitialization)
    vi.mocked(dataSource.query).mockResolvedValue([{ '?column?': 1 }])
    const service = createService(dataSource)

    const firstCheck = service.isReady()
    const secondCheck = service.isReady()

    expect(dataSource.initialize).toHaveBeenCalledTimes(1)
    dataSource.isInitialized = true
    resolveInitialization?.(dataSource as DataSource)

    await expect(Promise.all([firstCheck, secondCheck])).resolves.toEqual([true, true])
    expect(dataSource.initialize).toHaveBeenCalledTimes(1)
    expect(dataSource.query).toHaveBeenCalledTimes(2)
    expect(dataSource.query).toHaveBeenNthCalledWith(1, 'SELECT 1')
    expect(dataSource.query).toHaveBeenNthCalledWith(2, 'SELECT 1')
  })
})

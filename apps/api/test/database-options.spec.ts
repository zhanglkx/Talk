import { Logger } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDatabaseOptions } from '../src/database/database-options.js'

const { constructions } = vi.hoisted(() => ({ constructions: [] as unknown[] }))

vi.mock('typeorm', async () => {
  const actual = await vi.importActual<typeof import('typeorm')>('typeorm')

  return {
    ...actual,
    DataSource: class extends actual.DataSource {
      constructor(options: ConstructorParameters<typeof actual.DataSource>[0]) {
        constructions.push(options)
        super(options)
      }
    },
  }
})

const databaseUrl = 'postgresql://ledger:secret@localhost:5432/ledger_options_test'

afterEach(() => {
  constructions.length = 0
  vi.restoreAllMocks()
})

describe('createDatabaseOptions', () => {
  it('returns the given url and does not open a connection or run migrations', () => {
    const initialize = vi.spyOn(DataSource.prototype, 'initialize')

    const options = createDatabaseOptions(databaseUrl)

    expect(options.url).toBe(databaseUrl)
    expect(options.manualInitialization).toBe(true)
    expect(options.synchronize).toBe(false)
    expect(options.migrationsRun).toBe(false)
    expect(initialize).not.toHaveBeenCalled()
    expect(constructions).toEqual([])
    expect(options).not.toBeInstanceOf(DataSource)
  })

  it('logs only a fixed message when the pool reports an error', () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const options = createDatabaseOptions(databaseUrl)
    const sensitiveError = new Error(`connection failed for ${databaseUrl}`)

    options.poolErrorHandler?.(sensitiveError)

    expect(errorLog).toHaveBeenCalledOnce()
    expect(errorLog).toHaveBeenCalledWith('Database pool error')
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain(databaseUrl)
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain('secret')
  })
})

import { DataSource } from 'typeorm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { closeCliDataSource, createCliDataSource } from '../src/database/data-source.js'

const databaseUrl = 'postgresql://ledger:secret@localhost:5432/ledger_cli_test'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('createCliDataSource', () => {
  it('reuses the shared options and does not connect', () => {
    const initialize = vi.spyOn(DataSource.prototype, 'initialize')
    const dataSource = createCliDataSource(databaseUrl)

    expect(dataSource.options).toMatchObject({
      url: databaseUrl,
      synchronize: false,
      migrationsRun: false,
    })
    expect(dataSource.isInitialized).toBe(false)
    expect(initialize).not.toHaveBeenCalled()
  })

  it('does not destroy a data source that never connected', async () => {
    const destroy = vi.spyOn(DataSource.prototype, 'destroy')
    const dataSource = createCliDataSource(databaseUrl)

    await closeCliDataSource(dataSource)

    expect(destroy).not.toHaveBeenCalled()
  })
})

describe('CLI data source entry', () => {
  let initialize: MockInstance<DataSource['initialize']>

  beforeEach(async () => {
    vi.resetModules()
    const { DataSource: CliDataSource } = await import('typeorm')
    initialize = vi.spyOn(CliDataSource.prototype, 'initialize').mockImplementation(() => {
      throw new Error('Loading the CLI entry must not connect to the database')
    })
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('exports one unconnected data source created by the shared factory', async () => {
    const databaseUrl = 'postgresql://127.0.0.1:1/ledger_cli_entry_test'
    vi.stubEnv('DATABASE_URL', databaseUrl)
    const { DataSource: CliDataSource } = await import('typeorm')
    const factory = await import('../src/database/data-source.js')
    const createDataSource = vi.spyOn(factory, 'createCliDataSource')

    const entry = await import('../src/database/cli-data-source.js')
    const secondImport = await import('../src/database/cli-data-source.js')
    const exportedDataSources = Object.values(entry).filter(
      (value) => value instanceof CliDataSource,
    )

    expect(exportedDataSources).toEqual([entry.default])
    expect(secondImport.default).toBe(entry.default)
    expect(createDataSource).toHaveBeenCalledExactlyOnceWith(databaseUrl)
    expect(entry.default).toBe(createDataSource.mock.results[0]?.value)
    expect(entry.default.options).toMatchObject({
      type: 'postgres',
      url: databaseUrl,
      manualInitialization: true,
      synchronize: false,
      migrationsRun: false,
    })
    const { createDatabaseOptions } = await import('../src/database/database-options.js')
    expect(entry.default.options.entities).toEqual(createDatabaseOptions(databaseUrl).entities)
    expect(entry.default.isInitialized).toBe(false)
    expect(initialize).not.toHaveBeenCalled()
  })

  it.each([
    { value: undefined, message: 'DATABASE_URL is required' },
    { value: '', message: 'DATABASE_URL is required' },
    { value: '   ', message: 'DATABASE_URL is required' },
    { value: 'not-a-url', message: 'DATABASE_URL must be a valid URL' },
    {
      value: 'https://127.0.0.1/ledger_cli_entry_test',
      message: 'DATABASE_URL must use postgres:// or postgresql://',
    },
    { value: 'postgresql://127.0.0.1', message: 'DATABASE_URL must be a valid URL' },
    { value: 'postgresql:///ledger_cli_entry_test', message: 'DATABASE_URL must be a valid URL' },
  ])(
    'rejects invalid DATABASE_URL ($value) before creating a data source',
    async ({ value, message }) => {
      vi.stubEnv('DATABASE_URL', value)
      const factory = await import('../src/database/data-source.js')
      const createDataSource = vi.spyOn(factory, 'createCliDataSource')

      await expect(import('../src/database/cli-data-source.js')).rejects.toThrow(message)

      expect(createDataSource).not.toHaveBeenCalled()
      expect(initialize).not.toHaveBeenCalled()
    },
  )
})

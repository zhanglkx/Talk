import 'reflect-metadata'
import { DataSource, Table } from 'typeorm'
import type { MigrationInterface, QueryRunner } from 'typeorm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabaseOptions } from '../src/database/database-options.js'
import { createCliDataSource } from '../src/database/data-source.js'

const databaseUrl = 'postgresql://127.0.0.1:1/ledger_users_migration_test'
const migrationModulePath = new URL(
  '../src/database/migrations/1791849600000-create-users.ts',
  import.meta.url,
).href

type MigrationConstructor = new () => MigrationInterface

class MetadataDataSource extends DataSource {
  async buildOfflineMetadata(): Promise<void> {
    await this.buildMetadatas()
  }
}

async function loadMigration(): Promise<MigrationConstructor> {
  const migrationModule = await import(migrationModulePath)
  expect(migrationModule.CreateUsers1791849600000).toBeTypeOf('function')
  return migrationModule.CreateUsers1791849600000
}

function createQueryRunner() {
  const runner = {
    createTable: vi.fn<QueryRunner['createTable']>().mockResolvedValue(undefined),
    dropTable: vi.fn<QueryRunner['dropTable']>().mockResolvedValue(undefined),
  } satisfies Pick<QueryRunner, 'createTable' | 'dropTable'>

  return { runner, queryRunner: runner as unknown as QueryRunner }
}

beforeEach(() => {
  vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
    throw new Error('Migration tests must not connect to the database')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CreateUsers migration', () => {
  it('creates users with columns and constraints matching the User entity', async () => {
    const CreateUsers = await loadMigration()
    const { runner, queryRunner } = createQueryRunner()

    await new CreateUsers().up(queryRunner)

    expect(runner.createTable).toHaveBeenCalledOnce()
    const table = runner.createTable.mock.calls[0]?.[0]
    expect(table).toBeInstanceOf(Table)
    if (!(table instanceof Table)) throw new Error('Expected a TypeORM Table')

    expect(table.name).toBe('users')
    expect(table.columns).toHaveLength(4)
    expect(table.columns.filter((column) => column.isPrimary).map((column) => column.name)).toEqual(
      ['id'],
    )
    expect(table.findColumnByName('id')).toMatchObject({
      type: 'uuid',
      isPrimary: true,
      isNullable: false,
      isGenerated: false,
      default: undefined,
    })
    expect(table.findColumnByName('username')).toMatchObject({
      type: 'varchar',
      length: '32',
      isNullable: false,
    })
    expect(table.findColumnByName('password_hash')).toMatchObject({
      type: 'text',
      isNullable: false,
    })
    expect(table.findColumnByName('created_at')).toMatchObject({
      type: 'timestamptz',
      isNullable: false,
      default: 'now()',
    })
    const uniqueColumnSets = [
      ...table.uniques.map((constraint) => constraint.columnNames),
      ...table.indices.filter((index) => index.isUnique).map((index) => index.columnNames),
      ...table.columns.filter((column) => column.isUnique).map((column) => [column.name]),
    ]
    expect(uniqueColumnSets).toContainEqual(['username'])
    expect(runner.dropTable).not.toHaveBeenCalled()
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })

  it('drops only users when reverting the migration', async () => {
    const CreateUsers = await loadMigration()
    const { runner, queryRunner } = createQueryRunner()

    await new CreateUsers().down(queryRunner)

    expect(runner.dropTable).toHaveBeenCalledOnce()
    expect(runner.dropTable.mock.calls[0]?.[0]).toBe('users')
    expect(runner.createTable).not.toHaveBeenCalled()
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })

  it('registers the same migration in shared options and the unconnected CLI data source', async () => {
    const CreateUsers = await loadMigration()
    const options = createDatabaseOptions(databaseUrl)
    const dataSource = createCliDataSource(databaseUrl)

    expect(options).toMatchObject({
      migrations: [CreateUsers],
      manualInitialization: true,
      synchronize: false,
      migrationsRun: false,
    })
    expect(dataSource.options.migrations).toEqual([CreateUsers])
    const metadataDataSource = new MetadataDataSource(options)
    await metadataDataSource.buildOfflineMetadata()
    expect(metadataDataSource.migrations).toHaveLength(1)
    expect(metadataDataSource.migrations[0]).toBeInstanceOf(CreateUsers)
    expect(metadataDataSource.isInitialized).toBe(false)
    expect(dataSource.isInitialized).toBe(false)
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })
})

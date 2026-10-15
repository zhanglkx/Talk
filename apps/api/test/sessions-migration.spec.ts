import 'reflect-metadata'
import { DataSource, Table } from 'typeorm'
import type { MigrationInterface, QueryRunner } from 'typeorm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabaseOptions } from '../src/database/database-options.js'
import { createCliDataSource } from '../src/database/data-source.js'
import { CreateUsers1791849600000 } from '../src/database/migrations/1791849600000-create-users.js'

const databaseUrl = 'postgresql://127.0.0.1:1/ledger_sessions_migration_test'
const migrationModulePath = new URL(
  '../src/database/migrations/1791936000000-create-sessions.ts',
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
  expect(migrationModule.CreateSessions1791936000000).toBeTypeOf('function')
  return migrationModule.CreateSessions1791936000000
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

describe('CreateSessions migration', () => {
  it('creates sessions with the planned columns, foreign key, check and index', async () => {
    const CreateSessions = await loadMigration()
    const { runner, queryRunner } = createQueryRunner()

    await new CreateSessions().up(queryRunner)

    expect(runner.createTable).toHaveBeenCalledOnce()
    const [table, , createForeignKeys, createIndices] = runner.createTable.mock.calls[0] ?? []
    expect(table).toBeInstanceOf(Table)
    if (!(table instanceof Table)) throw new Error('Expected a TypeORM Table')
    // createTable 的第 3、4 个参数为 false 时会跳过外键和索引；不传就是默认的 true。
    expect(createForeignKeys).not.toBe(false)
    expect(createIndices).not.toBe(false)

    expect(table.name).toBe('sessions')
    expect(table.columns.map((column) => column.name)).toEqual([
      'session_key_hash',
      'user_id',
      'data',
      'created_at',
      'last_seen_at',
      'idle_expires_at',
      'absolute_expires_at',
    ])
    expect(table.columns.filter((column) => column.isPrimary).map((column) => column.name)).toEqual(
      ['session_key_hash'],
    )
    expect(table.findColumnByName('session_key_hash')).toMatchObject({
      type: 'char',
      length: '64',
      isPrimary: true,
      isNullable: false,
      isGenerated: false,
      default: undefined,
    })
    expect(table.findColumnByName('user_id')).toMatchObject({
      type: 'uuid',
      isNullable: false,
      default: undefined,
    })
    expect(table.findColumnByName('data')).toMatchObject({
      type: 'jsonb',
      isNullable: false,
      default: undefined,
    })
    expect(table.findColumnByName('created_at')).toMatchObject({
      type: 'timestamptz',
      isNullable: false,
      default: 'now()',
    })
    for (const name of ['last_seen_at', 'idle_expires_at', 'absolute_expires_at']) {
      expect(table.findColumnByName(name)).toMatchObject({
        type: 'timestamptz',
        isNullable: false,
        default: undefined,
      })
    }

    expect(table.foreignKeys).toHaveLength(1)
    expect(table.foreignKeys[0]).toMatchObject({
      name: 'fk_sessions_user_id',
      columnNames: ['user_id'],
      referencedTableName: 'users',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    })
    expect(table.checks).toHaveLength(1)
    expect(table.checks[0]).toMatchObject({
      name: 'chk_sessions_idle_within_absolute',
      expression: '"idle_expires_at" <= "absolute_expires_at"',
    })
    expect(table.indices).toHaveLength(1)
    expect(table.indices[0]).toMatchObject({
      name: 'idx_sessions_idle_expires_at',
      columnNames: ['idle_expires_at'],
      isUnique: false,
    })
    expect(runner.dropTable).not.toHaveBeenCalled()
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })

  it('drops only sessions when reverting the migration', async () => {
    const CreateSessions = await loadMigration()
    const { runner, queryRunner } = createQueryRunner()

    await new CreateSessions().down(queryRunner)

    expect(runner.dropTable).toHaveBeenCalledOnce()
    expect(runner.dropTable.mock.calls[0]?.[0]).toBe('sessions')
    expect(runner.createTable).not.toHaveBeenCalled()
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })

  it('registers users then sessions in shared options and the unconnected CLI data source', async () => {
    const CreateSessions = await loadMigration()
    const options = createDatabaseOptions(databaseUrl)
    const dataSource = createCliDataSource(databaseUrl)

    // sessions 的外键引用 users，所以 users 的迁移必须排在前面。
    expect(options.migrations).toEqual([CreateUsers1791849600000, CreateSessions])
    expect(dataSource.options.migrations).toEqual(options.migrations)
    const metadataDataSource = new MetadataDataSource(options)
    await metadataDataSource.buildOfflineMetadata()
    expect(metadataDataSource.migrations).toHaveLength(2)
    expect(metadataDataSource.migrations[0]).toBeInstanceOf(CreateUsers1791849600000)
    expect(metadataDataSource.migrations[1]).toBeInstanceOf(CreateSessions)
    expect(metadataDataSource.isInitialized).toBe(false)
    expect(dataSource.isInitialized).toBe(false)
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })
})

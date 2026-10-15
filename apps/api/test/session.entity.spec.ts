import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabaseOptions } from '../src/database/database-options.js'
import { createCliDataSource } from '../src/database/data-source.js'
import { User } from '../src/modules/users/user.entity.js'

const databaseUrl = 'postgresql://127.0.0.1:1/ledger_session_metadata_test'
const entityModulePath = new URL('../src/modules/auth/session.entity.ts', import.meta.url).href

class MetadataDataSource extends DataSource {
  async buildOfflineMetadata(): Promise<void> {
    await this.buildMetadatas()
  }
}

async function loadSessionEntity(): Promise<new () => object> {
  const entityModule = await import(entityModulePath)
  expect(entityModule.Session).toBeTypeOf('function')
  return entityModule.Session
}

async function buildSessionMetadata() {
  const Session = await loadSessionEntity()
  const dataSource = new MetadataDataSource({
    ...createDatabaseOptions(databaseUrl),
    entities: [Session],
  })
  await dataSource.buildOfflineMetadata()
  expect(dataSource.isInitialized).toBe(false)
  return dataSource.getMetadata(Session)
}

beforeEach(() => {
  vi.spyOn(DataSource.prototype, 'initialize').mockImplementation(() => {
    throw new Error('Session metadata tests must not connect to the database')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Session entity', () => {
  it('maps sessions with the planned column names, types and nullability', async () => {
    const metadata = await buildSessionMetadata()

    expect(metadata.tableName).toBe('sessions')
    expect(metadata.primaryColumns.map((column) => column.propertyName)).toEqual(['sessionKeyHash'])
    expect(metadata.columns).toHaveLength(7)
    expect(metadata.findColumnWithPropertyName('sessionKeyHash')).toMatchObject({
      databaseName: 'session_key_hash',
      type: 'char',
      length: '64',
      isPrimary: true,
      isNullable: false,
    })
    expect(metadata.findColumnWithPropertyName('userId')).toMatchObject({
      databaseName: 'user_id',
      type: 'uuid',
      isNullable: false,
    })
    expect(metadata.findColumnWithPropertyName('data')).toMatchObject({
      databaseName: 'data',
      type: 'jsonb',
      isNullable: false,
    })
    expect(metadata.findColumnWithPropertyName('createdAt')).toMatchObject({
      databaseName: 'created_at',
      type: 'timestamptz',
      isNullable: false,
      isCreateDate: true,
    })
    for (const [propertyName, databaseName] of [
      ['lastSeenAt', 'last_seen_at'],
      ['idleExpiresAt', 'idle_expires_at'],
      ['absoluteExpiresAt', 'absolute_expires_at'],
    ] as const) {
      expect(metadata.findColumnWithPropertyName(propertyName)).toMatchObject({
        databaseName,
        type: 'timestamptz',
        isNullable: false,
        // 这三列由以后的 Store 显式写入，不能被 TypeORM 当成自动维护的时间列。
        isCreateDate: false,
        isUpdateDate: false,
      })
    }
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })

  it('declares the idle-expiry index and the check that keeps it within the absolute expiry', async () => {
    const metadata = await buildSessionMetadata()

    expect(
      metadata.indices.map((index) => ({
        name: index.name,
        columns: index.columns.map((column) => column.propertyName),
        isUnique: index.isUnique,
      })),
    ).toEqual([
      { name: 'idx_sessions_idle_expires_at', columns: ['idleExpiresAt'], isUnique: false },
    ])
    expect(
      metadata.checks.map((check) => ({ name: check.name, expression: check.expression })),
    ).toEqual([
      {
        name: 'chk_sessions_idle_within_absolute',
        expression: '"idle_expires_at" <= "absolute_expires_at"',
      },
    ])
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })

  it('registers User and Session in shared application options and the CLI data source', async () => {
    const Session = await loadSessionEntity()
    const options = createDatabaseOptions(databaseUrl)
    const dataSource = createCliDataSource(databaseUrl)

    expect(options.entities).toEqual([User, Session])
    expect(dataSource.options.entities).toEqual(options.entities)
    expect(dataSource.options).toMatchObject({ synchronize: false, migrationsRun: false })
    expect(dataSource.isInitialized).toBe(false)
    expect(DataSource.prototype.initialize).not.toHaveBeenCalled()
  })
})
